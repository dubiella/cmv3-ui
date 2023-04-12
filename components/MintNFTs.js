import styles from "../styles/Home.module.css";
import {useMetaplex} from "./useMetaplex";
import {useState} from "react";
import {useWallet} from "@solana/wallet-adapter-react";
import {PublicKey} from "@solana/web3.js";
import Image from "next/image";
import {
  Container,
  Grid,
  Typography,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
  Paper,
  Stack,
  Box,
  Button,
  LinearProgress, Step
} from '@mui/material';

export const MintNFTs = () => {
  const {metaplex} = useMetaplex();
  const wallet = useWallet();

  const [nft, setNft] = useState(null);

  const [cmItemsAvailable, setCmItemsAvailable] = useState(null);
  const [cmItemsMinted, setCmItemsMinted] = useState(null);
  const [cmStartDated, setCmStartDated] = useState(null);
  const [cmSolPayment, setCmSolPayment] = useState(null);


  const [disableMint, setDisableMint] = useState(true);
  const [minting, setMinting] = useState(false);

  const candyMachineAddress = new PublicKey(
      process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
  );
  let candyMachine;
  let walletBalance;

  const addListener = async () => {
    // add a listener to monitor changes to the candy guard
    metaplex.connection.onAccountChange(candyMachine.candyGuard.address,
        () => checkEligibility()
    );

    // add a listener to monitor changes to the user's wallet
    metaplex.connection.onAccountChange(metaplex.identity().publicKey,
        () => checkEligibility()
    );

    // add a listener to reevaluate if the user is allowed to mint if startDate is reached
    const slot = await metaplex.connection.getSlot();
    const solanaTime = await metaplex.connection.getBlockTime(slot);
    const startDateGuard = candyMachine.candyGuard.guards.startDate;
    if (startDateGuard != null) {
      const candyStartDate = startDateGuard.date.toString(10);
      const refreshTime = candyStartDate - solanaTime.toString(10);
      if (refreshTime > 0) {
        setTimeout(() => checkEligibility(), refreshTime * 1000);
      }
    }

    // also reevaluate eligibility after endDate is reached
    const endDateGuard = candyMachine.candyGuard.guards.endDate;
    if (endDateGuard != null) {
      const candyEndDate = endDateGuard.date.toString(10);
      const refreshTime = solanaTime.toString(10) - candyEndDate;
      if (refreshTime > 0) {
        setTimeout(() => checkEligibility(), refreshTime * 1000);
      }
    }
  };

  const checkEligibility = async () => {
    //wallet not connected?
    if (!wallet.connected) {
      setDisableMint(true);
      return;
    }

    // read candy machine state from chain
    candyMachine = await metaplex
        .candyMachines()
        .findByAddress({address: candyMachineAddress});

    // enough items available?
    if (
        candyMachine.itemsMinted.toString(10) -
        candyMachine.itemsAvailable.toString(10) >
        0
    ) {
      console.error("not enough items available");
      setDisableMint(true);
      return;
    }

    setCmItemsAvailable(candyMachine.itemsAvailable.toString(10));
    setCmItemsMinted(candyMachine.itemsMinted.toString(10));

    // guard checks have to be done for the relevant guard group! Example is for the default groups defined in Part 1 of the CM guide
    const guard = candyMachine.candyGuard.guards;

    // Calculate current time based on Solana BlockTime which the on chain program is using - startTime and endTime guards will need that
    const slot = await metaplex.connection.getSlot();
    const solanaTime = await metaplex.connection.getBlockTime(slot);

    if (guard.startDate != null) {
      const candyStartDate = guard.startDate.date.toString(10);

      if (solanaTime < candyStartDate) {
        console.error("startDate: CM not live yet");
        setDisableMint(true);
        return;
      }

      const date = new Date(parseInt(candyStartDate) * 1000);
      setCmStartDated(date.toDateString());

    }

    if (guard.endDate != null) {
      const candyEndDate = guard.endDate.date.toString(10);
      if (solanaTime > candyEndDate) {
        console.error("endDate: CM not live anymore");
        setDisableMint(true);
        return;
      }
    }

    if (guard.addressGate != null) {
      if (metaplex.identity().publicKey.toBase58() != guard.addressGate.address.toBase58()) {
        console.error("addressGate: You are not allowed to mint");
        setDisableMint(true);
        return;
      }
    }

    if (guard.mintLimit != null) {
      const mitLimitCounter = metaplex.candyMachines().pdas().mintLimitCounter({
        id: guard.mintLimit.id,
        user: metaplex.identity().publicKey,
        candyMachine: candyMachine.address,
        candyGuard: candyMachine.candyGuard.address,
      });
      //Read Data from chain
      const mintedAmountBuffer = await metaplex.connection.getAccountInfo(mitLimitCounter, "processed");
      let mintedAmount;
      if (mintedAmountBuffer != null) {
        mintedAmount = setMintedAmount(mintedAmountBuffer.data.readUintLE(0, 1));
      }
      if (mintedAmount != null && mintedAmount >= guard.mintLimit.limit) {
        console.error("mintLimit: mintLimit reached!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.solPayment != null) {
      walletBalance = await metaplex.connection.getBalance(
          metaplex.identity().publicKey
      );

      const costInLamports = guard.solPayment.amount.basisPoints.toString(10);
      setCmSolPayment(costInLamports);

      if (costInLamports > walletBalance) {
        console.error("solPayment: Not enough SOL!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.freezeSolPayment != null) {
      walletBalance = await metaplex.connection.getBalance(
          metaplex.identity().publicKey
      );

      const costInLamports = guard.freezeSolPayment.amount.basisPoints.toString(10);

      if (costInLamports > walletBalance) {
        console.error("freezeSolPayment: Not enough SOL!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.nftGate != null) {
      const ownedNfts = await metaplex.nfts().findAllByOwner({owner: metaplex.identity().publicKey});
      const nftsInCollection = ownedNfts.filter(obj => {
        return (obj.collection?.address.toBase58() === guard.nftGate.requiredCollection.toBase58()) && (obj.collection?.verified === true);
      });
      if (nftsInCollection.length < 1) {
        console.error("nftGate: The user has no NFT to pay with!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.nftBurn != null) {
      const ownedNfts = await metaplex.nfts().findAllByOwner({owner: metaplex.identity().publicKey});
      const nftsInCollection = ownedNfts.filter(obj => {
        return (obj.collection?.address.toBase58() === guard.nftBurn.requiredCollection.toBase58()) && (obj.collection?.verified === true);
      });
      if (nftsInCollection.length < 1) {
        console.error("nftBurn: The user has no NFT to pay with!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.nftPayment != null) {
      const ownedNfts = await metaplex.nfts().findAllByOwner({owner: metaplex.identity().publicKey});
      const nftsInCollection = ownedNfts.filter(obj => {
        return (obj.collection?.address.toBase58() === guard.nftPayment.requiredCollection.toBase58()) && (obj.collection?.verified === true);
      });
      if (nftsInCollection.length < 1) {
        console.error("nftPayment: The user has no NFT to pay with!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.redeemedAmount != null) {
      if (guard.redeemedAmount.maximum.toString(10) <= candyMachine.itemsMinted.toString(10)) {
        console.error("redeemedAmount: Too many NFTs have already been minted!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.tokenBurn != null) {
      const ata = await metaplex.tokens().pdas().associatedTokenAccount({
        mint: guard.tokenBurn.mint,
        owner: metaplex.identity().publicKey
      });
      const balance = await metaplex.connection.getTokenAccountBalance(ata);
      if (balance < guard.tokenBurn.amount.basisPoints.toNumber()) {
        console.error("tokenBurn: Not enough SPL tokens to burn!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.tokenGate != null) {
      const ata = await metaplex.tokens().pdas().associatedTokenAccount({
        mint: guard.tokenGate.mint,
        owner: metaplex.identity().publicKey
      });
      const balance = await metaplex.connection.getTokenAccountBalance(ata);
      if (balance < guard.tokenGate.amount.basisPoints.toNumber()) {
        console.error("tokenGate: Not enough SPL tokens!");
        setDisableMint(true);
        return;
      }
    }

    if (guard.tokenPayment != null) {
      const ata = await metaplex.tokens().pdas().associatedTokenAccount({
        mint: guard.tokenPayment.mint,
        owner: metaplex.identity().publicKey
      });
      const balance = await metaplex.connection.getTokenAccountBalance(ata);
      if (balance < guard.tokenPayment.amount.basisPoints.toNumber()) {
        console.error("tokenPayment: Not enough SPL tokens to pay!");
        setDisableMint(true);
        return;
      }
      if (guard.freezeTokenPayment != null) {
        const ata = await metaplex.tokens().pdas().associatedTokenAccount({
          mint: guard.freezeTokenPayment.mint,
          owner: metaplex.identity().publicKey
        });
        const balance = await metaplex.connection.getTokenAccountBalance(ata);
        if (balance < guard.tokenPayment.amount.basisPoints.toNumber()) {
          console.error("freezeTokenPayment: Not enough SPL tokens to pay!");
          setDisableMint(true);
          return;
        }
      }
    }

    //good to go! Allow them to mint
    setDisableMint(false);
  };

  // show and do nothing if no wallet is connected
  if (!wallet.connected) {
    return null;
  }

  // if it's the first time we are processing this function with a connected wallet we read the CM data and add Listeners
  if (candyMachine === undefined) {
    (async () => {
          // read candy machine data to get the candy guards address
          await checkEligibility();
          // Add listeners to refresh CM data to reevaluate if minting is allowed after the candy guard updates or startDate is reached
          addListener();
        }
    )();
  }

  const onClick = async () => {
    setMinting(true);


    try {
      await metaplex.candyMachines().mint({
        candyMachine,
        collectionUpdateAuthority: candyMachine.authorityAddress,
      });
      setNft(nft);
    } catch (e) {
      console.error(e);

      setMinting(false);
    }

  };

  return (
      <div>

        <Stack alignItems="center">

          <Stack direction="row" justifyContent="center" sx={{pb:4}}>
            <Typography variant="h6" sx={{p:1}}>
              Price:
            </Typography>
            <Image
                src="/sol.svg"
                width="30"
                height="30"
                alt="sol"
            />
            <Typography variant="h6" sx={{p:1}}>
              { cmSolPayment }
            </Typography>

          </Stack>

          {!minting ? (
              <Button
                  size="large" variant="outlined" sx={{p: 3}}
                  onClick={onClick}>
                mint NFT
              </Button>
          ) : (
              <Button
                  size="large" variant="outlined" sx={{p: 3}}
                  disabled>
                mint NFT
              </Button>
          )}


          <Box sx={{width: 300}}>
            <Typography variant="h6" color="text.secondary"
                        sx={{wordWrap: "break-word", p: 1}}>{cmItemsMinted} / 1000</Typography>
            {minting ? (
                <LinearProgress/>
            ) : (
                <LinearProgress variant="determinate" value={(cmItemsMinted / 10)}/>
            )}
          </Box>


        </Stack>


        {/*<ul>*/}
        {/*  <li>Items Available: { cmItemsAvailable } </li>*/}
        {/*  <li>Items Minted: { cmItemsMinted } </li>*/}
        {/*  <li>Sol Payment Price: { cmSolPayment } </li>*/}
        {/*  <li>Mint Time Start: { cmStartDated } </li>*/}
        {/*</ul>*/}

        <Box sx={{py: 6}}>
          {nft && (
              <Paper square variant="outlined" sx={{width: 300, height: 400}}>

                <Image
                    src={nft?.json?.image || "/fallbackImage.jpg"}
                    width="300"
                    height="300"
                    alt="The downloaded illustration of the provided NFT address."
                />

                <Typography variant="h6" color="text.secondary" sx={{
                  wordWrap: "break-word",
                  p: 2
                }}>{nft?.name || "ArtMonkees Item #000"}</Typography>
              </Paper>
          )}
        </Box>


      </div>
  );
};