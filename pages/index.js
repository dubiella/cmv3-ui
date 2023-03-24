import styles from "../styles/Home.module.css";
import { useMemo, useState, useEffect } from "react";
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
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {clusterApiUrl, PublicKey} from "@solana/web3.js";
import { MetaplexProvider } from "../components/MetaplexProvider";
import { MintNFTs } from "../components/MintNFTs";
import "@solana/wallet-adapter-react-ui/styles.css";
import dynamic from 'next/dynamic';
const env_rpcHost = process.env.NEXT_PUBLIC_RPC_HOST;
const env_network = process.env.NEXT_PUBLIC_NETWORK;

const network = (event) => {
  switch (event.target.value) {
    case "Mainnet":
      setNetwork(WalletAdapterNetwork.Mainnet);
      break;
    case "Devnet":
      setNetwork(WalletAdapterNetwork.Devnet);
      break;
    case "Testnet":
      setNetwork(WalletAdapterNetwork.Testnet);
      break;
    default:
      setNetwork(WalletAdapterNetwork.Devnet);
      break;
  }
};

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
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <MetaplexProvider>
              <div className={styles.App}>
                <ButtonWrapper />
                <MintNFTs />
              </div>
            </MetaplexProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </div>
  );
}
