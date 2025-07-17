import {
  Box,
  Collapse,
  Flex,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useRadioGroup,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../button';
import { AllOvenDatum, OvenStorage } from '../../interfaces';
import RadioCard from '../radio';
import DepositorsInput from '../input';
import { trimAddress } from '../../utils/addressUtils';
import { useWallet } from '../../wallet/hooks';
import { addRemoveDepositorList, enableDisableAnyDepositor } from '../../contracts/ctez';
import { logger } from '../../utils/logger';
import { useThemeColors, useTxLoader } from '../../hooks/utilHooks';

interface IChangeDepositorProps {
  canAnyoneDeposit: boolean;
  oven: AllOvenDatum;
  ovenStorage: OvenStorage | undefined;
  isOpen: boolean;
  onClose: () => void;
}

interface IDepositorItem {
  value: string;
  label: string;
  noDelete?: boolean;
}

const ChangeDepositor: React.FC<IChangeDepositorProps> = (props) => {
  const [{ pkh: userAddress }] = useWallet();
  const toast = useToast();
  const { t } = useTranslation(['common']);
  const [text2] = useThemeColors(['text2']);
  const options = useMemo(() => ['Whitelist', 'Everyone'], []);
  const [depType, setDepType] = useState(options[0]);
  const [depositors, setDepositors] = useState<IDepositorItem[]>([]);

  const { getRootProps, getRadioProps } = useRadioGroup({
    name: 'depositType',
    value: depType,
    onChange: setDepType,
  });
  const group = getRootProps();
  const handleProcessing = useTxLoader();

  const getWhiteList = (recvData: any) => {
    try {
      if (!recvData?.depositors?.whitelist)
        return [];
      const list = Array.prototype.slice.call(recvData.depositors.whitelist);
      return list;
    } catch (err) {
      console.log(err);
      return [];
    }
  };
  const whitelist = getWhiteList(props.ovenStorage);
  useEffect(() => {
    if (props.isOpen && depositors.length === 0 && props.ovenStorage) {
      setDepositors([
        {
          label: 'You',
          value: props.ovenStorage.handle.owner,
          noDelete: true,
        },
        ...(!props.canAnyoneDeposit
          ? (whitelist as string[])?.map((dep) => ({
            label: trimAddress(dep),
            value: dep,
          }))
          : []),
      ]);
      setDepType(props.canAnyoneDeposit ? options[1] : options[0]);
    }
    if (!props.isOpen) {
      setDepositors([]);
    }
  }, [
    props.ovenStorage,
    props.oven,
    depositors.length,
    props.canAnyoneDeposit,
    props.isOpen,
    options,
  ]);

  const handleAllowAnyone = async () => {
    if (props.oven.value.address && userAddress) {
      try {
        const result = await enableDisableAnyDepositor(props.oven.value.address, true);
        if (result) {
          toast({
            description: t('txSubmitted'),
            status: 'success',
          });
        }
      } catch (error: any) {
        logger.error(error);
        const errorText = error?.data?.[1].with.string as string || t('txFailed');
        toast({
          description: errorText,
          status: 'error',
        });
      }
    }
  };

  const handleDepositorSubmit = async () => {
    if (props.oven.value.address && props.ovenStorage && userAddress) {
      try {
        const userWhiteList = depositors
          .map((item: IDepositorItem) => item?.value ?? item)
          .filter((o) => o !== userAddress);
        const whitelistDepositors = getWhiteList(props.ovenStorage);
        const userDenyList = !props.canAnyoneDeposit
          ? (whitelistDepositors as string[]).filter((o) => !userWhiteList.includes(o))
          : undefined;
        const result = await addRemoveDepositorList(
          props.oven.value.address,
          props.ovenStorage,
          userWhiteList,
          userDenyList,
        );
        handleProcessing(result);
      } catch (error: any) {
        logger.error(error);
        const errorText = error?.data?.[1].with.string as string || t('txFailed');
        toast({
          description: errorText,
          status: 'error',
        });
      }
    }
  };

  const handleConfirm = () => {
    if (depType === options[0]) {
      handleDepositorSubmit();
    } else {
      handleAllowAnyone();
    }
  };

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontWeight="500">Change Depositor</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <FormControl w="100%" mb={4}>
            <FormLabel color={text2} fontWeight="500" fontSize="xs">
              {t('depositorOp')}
            </FormLabel>

            <Flex {...group} w="100%" justifyContent="space-between">
              {options.map((value) => {
                const radio = getRadioProps({ value });
                return (
                  <RadioCard key={value} {...radio}>
                    {value}
                  </RadioCard>
                );
              })}
            </Flex>
          </FormControl>

          <Collapse in={depType === options[0]}>
            <DepositorsInput depositors={depositors} onChange={setDepositors} />
          </Collapse>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={props.onClose}>
            {t('cancel')}
          </Button>
          <Box w={2} />
          <Button onClick={handleConfirm}>Confirm</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ChangeDepositor;
