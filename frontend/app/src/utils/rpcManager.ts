import { RPC_URL } from './globals';
import { getNodeURL } from './settingUtils';
import { initTezos } from '../contracts/client';

// Global RPC URL state
let currentRpcUrl: string = RPC_URL;
let isInitialized = false;

// Initialize RPC URL and Tezos immediately when module loads
const initializeImmediately = () => {
  // Try to get any saved URL from localStorage (without user address)
  // This is a fallback for when we don't have a user address yet
  const savedUrls = Object.keys(localStorage)
    .filter(key => key.startsWith('nodeURL:'))
    .map(key => localStorage.getItem(key))
    .filter(url => url && url !== RPC_URL);
  
  if (savedUrls.length > 0) {
    // Use the first saved URL we find
    const url = savedUrls[0]!.replace(/^@+/, '').trim();
    currentRpcUrl = url;
  }
  
  isInitialized = true;
  
  // Initialize Tezos immediately with the RPC URL
  try {
    initTezos(currentRpcUrl);
  } catch (error) {
    console.error('Failed to initialize Tezos:', error);
  }
};

// Initialize immediately when module loads
initializeImmediately();

export const getCurrentRpcUrl = (): string => {
  if (!isInitialized) {
    return RPC_URL;
  }
  return currentRpcUrl;
};

export const setCurrentRpcUrl = (url: string, userAddress?: string): void => {
  // Clean the URL
  const cleanUrl = url.replace(/^@+/, '').trim();
  currentRpcUrl = cleanUrl;
  
  // Save to localStorage if user address is provided
  if (userAddress) {
    localStorage.setItem(`nodeURL:${userAddress}`, cleanUrl);
  }
};

export const initializeRpcUrl = (userAddress?: string): string => {
  // If we have a user address, try to get their saved URL
  const savedUrl = userAddress ? getNodeURL(userAddress) : null;
  
  if (savedUrl) {
    // User has a saved URL preference, use it
    const cleanUrl = savedUrl.replace(/^@+/, '').trim();
    currentRpcUrl = cleanUrl;
    
    // Reinitialize Tezos with the new URL
    try {
      initTezos(cleanUrl);
    } catch (error) {
      console.error('Failed to reinitialize Tezos:', error);
    }
  }
  
  return currentRpcUrl;
};

export const isRpcInitialized = (): boolean => {
  return isInitialized;
};

export const getRpcUrlForUser = (userAddress?: string): string => {
  if (userAddress) {
    const savedUrl = getNodeURL(userAddress);
    return savedUrl ? savedUrl.replace(/^@+/, '').trim() : RPC_URL;
  }
  return currentRpcUrl;
};