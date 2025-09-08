import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Input,
  VStack,
  Text,
  HStack,
} from '@chakra-ui/react';
import Button from '../button';
import { initTezos, setWalletProvider } from '../../contracts/client';
import { APP_NAME, NETWORK, RPC_URL } from '../../utils/globals';
import { getBeaconInstance, isWalletConnected } from '../../wallet';
import { WalletInterface } from '../../interfaces';
import { getRpcUrlForUser, setCurrentRpcUrl } from '../../utils/rpcManager';

interface ISettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsDialog: React.FC<ISettingsDialogProps> = ({ isOpen, onClose }) => {
  const [wallet, setWallet] = useState<Partial<WalletInterface>>({});
  const checkWalletConnection = async () => {
    const prevUsedWallet = isWalletConnected();
    if (prevUsedWallet) {
      const walletData = await getBeaconInstance(APP_NAME, true, NETWORK);
      walletData?.wallet && setWalletProvider(walletData.wallet);
      walletData && setWallet(walletData);
    }
  };
  const [rpcUrl, setRpcUrl] = useState('');

  useEffect(() => {
    checkWalletConnection();
  }, []);

  useEffect(() => {
    setRpcUrl(getRpcUrlForUser(wallet.pkh));
  }, [wallet.pkh]);
  
  
  // const [text2] = useThemeColors(['text2']);

  const handleSave = async () => {
    // Clean the RPC URL by removing any leading @ symbol and trimming whitespace
    const cleanRpcUrl = (rpcUrl ?? RPC_URL).replace(/^@+/, '').trim();
    
    // Validate URL format
    if (!cleanRpcUrl.startsWith('http://') && !cleanRpcUrl.startsWith('https://')) {
      console.error('Invalid RPC URL format. Must start with http:// or https://');
      return;
    }
    
    try {
      // Update the global RPC URL
      setCurrentRpcUrl(cleanRpcUrl, wallet.pkh);
      
      // Re-initialize Tezos with the new URL
      initTezos(cleanRpcUrl);
      
      // Force a page reload to ensure all components use the new RPC URL
      window.location.reload();
      
      onClose();
    } catch (error) {
      console.error('Failed to update RPC URL:', error);
    }
  };

  const handleCancel = () => {
    setRpcUrl('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Text fontSize="sm" textAlign="left" w="full">
              RPC URL
            </Text>
            <Input
              placeholder="Enter RPC URL..."
              value={rpcUrl ?? ''}
              onChange={(e) => setRpcUrl(e.target.value)}
              size="md"
            />
            <HStack spacing={2} w="full">
              <Button variant="outline" onClick={handleCancel} flex={1}>
                Cancel
              </Button>
              <Button onClick={handleSave} flex={1}>
                Save
              </Button>
            </HStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export { SettingsDialog };
