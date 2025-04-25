import { Center, Text } from '@chakra-ui/react';
import React, { useEffect, useMemo, useState } from 'react';
import SkeletonLayout from '../../components/skeleton';
import OvenCard from '../../components/OvenCard/OvenCard';
import OvenSummary from '../../components/OvenSummary';
import { useSortedOvensList } from '../../hooks/utilHooks';
import { useWallet } from '../../wallet/hooks';
import { useUserOvenData } from '../../api/queries';


const MyV1OvensContainer: React.FC = () => {
  const [{ pkh: userAddress }] = useWallet();
  const { data: myOvens, isLoading } = useUserOvenData(userAddress);

  const sortedOvens = useSortedOvensList([...(myOvens ?? [])]);

  if (userAddress == null) {
    return (
      <Center>
        <Text>Connect your wallet to see your v1 ovens</Text>
      </Center>
    );
  }

  if (isLoading) {
    return <SkeletonLayout component="OvenCard" />;
  }

  return (
    <>
      <OvenSummary ovens={sortedOvens || []} />
      {sortedOvens?.map((oven) => (
        <OvenCard key={oven.value.address} oven={oven} type="MyOvens" />
      ))}
    </>
  );
};

export default MyV1OvensContainer;
