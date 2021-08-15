/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import { ToastContainer, toast } from 'react-toastify';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';

import { PolyjuiceHttpProvider } from '@polyjuice-provider/web3';
import { AddressTranslator } from 'nervos-godwoken-integration';

import { CryptoChatWrapper } from '../lib/contracts/CryptoChatWrapper';
import { CONFIG } from '../config';

import * as CompiledContractArtifact from '../../build/contracts/ERC20.json';

async function createWeb3() {
    // Modern dapp browsers...
    if ((window as any).ethereum) {
        const godwokenRpcUrl = CONFIG.WEB3_PROVIDER_URL;
        const providerConfig = {
            rollupTypeHash: CONFIG.ROLLUP_TYPE_HASH,
            ethAccountLockCodeHash: CONFIG.ETH_ACCOUNT_LOCK_CODE_HASH,
            web3Url: godwokenRpcUrl
        };

        const provider = new PolyjuiceHttpProvider(godwokenRpcUrl, providerConfig);
        const web3 = new Web3(provider || Web3.givenProvider);

        try {
            // Request account access if needed
            await (window as any).ethereum.enable();
        } catch (error) {
            // User denied account access...
        }

        return web3;
    }

    console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
    return null;
}

export function App() {
    const [web3, setWeb3] = useState<Web3>(null);
    const [contract, setContract] = useState<CryptoChatWrapper>();
    const [accounts, setAccounts] = useState<string[]>();
    const [l2Balance, setL2Balance] = useState<bigint>();
    const [existingContractIdInputValue, setExistingContractIdInputValue] = useState<string>();
    const [messageValue, setChatMessageValue] = useState<Array<string>>([]);
    const [totalValue, setTotalMessageValue] = useState<number | undefined>();
    const [deployTxHash, setDeployTxHash] = useState<string | undefined>();
    const [polyjuiceAddress, setPolyjuiceAddress] = useState<string | undefined>();
    const [transactionInProgress, setTransactionInProgress] = useState(false);
    const toastId = React.useRef(null);
    const [newMessageStringInputValue, setNewMessageStringInputValue] = useState<
        string | undefined
    >();
    const [depositAddress, setDepositAddress] = useState<string | undefined>();
    const [balanceOf, setBalanceOf] = useState<bigint>();

    const force_bridge = 'https://force-bridge-test.ckbapp.dev/bridge/Ethereum/Nervos';
    const SUDT_Proxy = '0xf8e74012B83Cf046b894f951E8E37baC28AA2411';

    const account = accounts?.[0];

    // PolyJuiceAddress
    useEffect(() => {
        if (accounts?.[0]) {
            const addressTranslator = new AddressTranslator();
            setPolyjuiceAddress(addressTranslator.ethAddressToGodwokenShortAddress(accounts?.[0]));
        } else {
            setPolyjuiceAddress(undefined);
        }
    }, [accounts?.[0]]);

    // Toast Transaction
    useEffect(() => {
        if (transactionInProgress && !toastId.current) {
            toastId.current = toast.info(
                'Transaction in progress. Confirm MetaMask signing dialog and please wait...',
                {
                    position: 'top-right',
                    autoClose: false,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    closeButton: false
                }
            );
        } else if (!transactionInProgress && toastId.current) {
            toast.dismiss(toastId.current);
            toastId.current = null;
        }
    }, [transactionInProgress, toastId.current]);

    // Deploy Contract
    async function deployContract() {
        const _contract = new CryptoChatWrapper(web3);

        try {
            setDeployTxHash(undefined);
            setTransactionInProgress(true);

            const transactionHash = await _contract.deploy(account);

            setDeployTxHash(transactionHash);
            setExistingContractAddress(_contract.address);
            toast(
                'Successfully deployed a smart-contract. You can now proceed to get or set the value in a smart contract.',
                { type: 'success' }
            );
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    // Get Message
    useEffect(() => {
        if (!contract || !account) {
            return () => undefined;
        }

        const id = setInterval(async () => {
            try {
                const message = await contract.getChatMessageValue(account);
                setChatMessageValue(prevState => {
                    if (Array.isArray(prevState)) {
                        if (!prevState.includes(message)) {
                            return [...prevState, message];
                        }
                        return [...prevState];
                    }
                    return [message];
                });
            } catch (e) {
                console.error(e);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [contract, account]);

    // get Total Message
    useEffect(() => {
        if (!contract || !account) {
            return () => undefined;
        }

        const id = setInterval(async () => {
            try {
                const totalMessage = await contract.getTotalMessageValue(account);
                setTotalMessageValue(prevState => {
                    if (prevState) {
                        if (prevState < totalMessage) {
                            return totalMessage;
                        }
                        return prevState;
                    }
                    return totalMessage;
                });
            } catch (e) {
                console.error(e);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [contract, account]);

    // Set Existing Contract Address
    async function setExistingContractAddress(contractAddress: string) {
        const _contract = new CryptoChatWrapper(web3);
        _contract.useDeployed(contractAddress.trim());

        console.log('Deployed Contract Address:', contractAddress);

        setContract(_contract);
        setChatMessageValue(undefined);
    }

    // Set New Message
    async function setNewChatMessageValue() {
        try {
            setTransactionInProgress(true);
            await contract.setChatMessageValue(newMessageStringInputValue, account);
            toast('Successfully set latest message. ', { type: 'success' });
        } catch (error) {
            console.error(error);
            toast.error(
                'There was an error sending your transaction. Please check developer console.'
            );
        } finally {
            setTransactionInProgress(false);
        }
    }

    // Set Layer 2 Balance
    useEffect(() => {
        if (web3) {
            return;
        }

        (async () => {
            const _web3 = await createWeb3();
            setWeb3(_web3);

            const _accounts = [(window as any).ethereum.selectedAddress];
            setAccounts(_accounts);
            console.log({ _accounts });

            if (_accounts && _accounts[0]) {
                const _l2Balance = BigInt(await _web3.eth.getBalance(_accounts[0]));
                setL2Balance(_l2Balance);
            }
        })();
    });

    const getSUDTBalance = async () => {
        const contract = new web3.eth.Contract(CompiledContractArtifact.abi as any, SUDT_Proxy);

        const _balanceOf = await contract.methods.balanceOf(polyjuiceAddress).call({
            from: accounts?.[0]
        });
        console.log('BALACE::', _balanceOf);
        setBalanceOf(_balanceOf);
    };

    const redirect = () => {
        window.location.href = force_bridge;
    };

    const generateLayer2DepositAddress = async () => {
        const addressTranslator = new AddressTranslator();
        const _depositAddress = await addressTranslator.getLayer2DepositAddress(
            web3,
            accounts?.[0]
        );

        console.log(`Layer 2 Deposit Address on Layer 1: \n${_depositAddress.addressString}`);

        setDepositAddress(_depositAddress.addressString);

        getSUDTBalance();
    };

    const LoadingIndicator = () => <span className="rotating-icon">⚙️</span>;

    return (
        <div>
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            Nervos Layer 2 balance:{' '}
            <b>{l2Balance ? (l2Balance / 10n ** 8n).toString() : <LoadingIndicator />} CKB</b>
            <br />
            <br />
            Deployed contract address: <b>{contract?.address || '-'}</b> <br />
            Deploy transaction hash: <b>{deployTxHash || '-'}</b>
            <br />
            <hr />
            <p>
                The button below will deploy a new smart contract where you can use as a chat. You
                can create a new chat or access a existent one, using the deployed contract address.
                The chat also register the total of Messages registered. You can do that using the
                interface below.
            </p>
            <button onClick={deployContract} disabled={!l2Balance}>
                Deploy contract to create a new Chat
            </button>
            &nbsp;or&nbsp;
            <input
                placeholder="Existing contract id/address"
                onChange={e => setExistingContractIdInputValue(e.target.value)}
            />
            <button
                disabled={!existingContractIdInputValue || !l2Balance}
                onClick={() => setExistingContractAddress(existingContractIdInputValue)}
            >
                Use existing contract
            </button>
            <br />
            <br />
            <div>Total Messages: {totalValue}</div>
            {messageValue ? (
                <div>
                    Chats :
                    {messageValue.map(i => (
                        <p key={`m:${i}`}>{i}</p>
                    ))}
                </div>
            ) : null}
            <br />
            <br />
            <input onChange={e => setNewMessageStringInputValue(e.target.value)} />
            <button onClick={setNewChatMessageValue} disabled={!contract}>
                send
            </button>
            <br />
            <br />
            <br />
            <br />
            <hr />
            Your ETH address: <b>{accounts?.[0]}</b>
            <br />
            <br />
            {!depositAddress && (
                <button onClick={generateLayer2DepositAddress}>Get Layer 2 Deposit Address</button>
            )}
            <br />
            <div>
                Your Layer 2 Deposit Address on Layer 1:
                {depositAddress}
            </div>
            <br />
            <br />
            <button onClick={redirect}> Get sent to the Force Bridge</button>
            <br />
            <br />
            Place the Layer 2 Deposit Address as the recipient on the Force Bridge.
            <br />
            <br />
            Your Polyjuice address: <b>{polyjuiceAddress || ' - '}</b>
            <br />
            <br />
            <hr />
            The contract is deployed on Nervos Layer 2 - Godwoken + Polyjuice. After each
            transaction you might need to wait up to 120 seconds for the status to be reflected.
            <ToastContainer />
        </div>
    );
}
