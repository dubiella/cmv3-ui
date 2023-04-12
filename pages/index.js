import { useMemo, useState, useEffect } from "react";
import Head from 'next/head';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  GlowWalletAdapter,
  PhantomWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";
import { MetaplexProvider } from "../components/MetaplexProvider";
import { MintNFTs } from "../components/MintNFTs";
import "@solana/wallet-adapter-react-ui/styles.css";
import dynamic from 'next/dynamic';
const env_rpcHost = process.env.NEXT_PUBLIC_RPC_HOST;
const env_network = process.env.NEXT_PUBLIC_NETWORK;
import {Box, Container, Grid, Stack, Typography} from '@mui/material';
import Image from "next/image";
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export default function Home() {
  const [network, setNetwork] = useState(null);

  const endpoint = useMemo(() => env_rpcHost , [network]);
  // const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  useEffect(() => {
    switch (env_network) {
      case "Mainnet":
        setNetwork(WalletAdapterNetwork.Mainnet);
        break;
      case "Devnet":
        setNetwork(WalletAdapterNetwork.Devnet);
        break;
      case "Testnet":
        setNetwork(WalletAdapterNetwork.Testnet);
        break;
    }
  }, [network]);


  const wallets = useMemo(
      () => [
        new PhantomWalletAdapter(),
        new GlowWalletAdapter(),
        new SlopeWalletAdapter(),
        new SolflareWalletAdapter({ network }),
        new TorusWalletAdapter(),
      ],
      [network]
  );

  const ButtonWrapper = dynamic(() =>
      import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton)
  );


  return (
      <div>
        <Head>
          <title>ArtMonkees Mint</title>
        </Head>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
              <WalletModalProvider>
                <MetaplexProvider>
                  <Container maxWidth="xs" >
                    <Stack alignItems="center" sx={{pt:4}}>
                      <ButtonWrapper />
                      <Box sx={{p:4}}>
                        <Image
                            src="/img.svg"
                            width="300"
                            height="300"
                            alt=""
                        />
                      </Box>
                      <MintNFTs />
                    </Stack>
                  </Container>
                </MetaplexProvider>
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </ThemeProvider>
      </div>
  );
}