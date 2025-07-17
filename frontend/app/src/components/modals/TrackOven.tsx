import {
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import { validateContractAddress } from '@taquito/utils';
import { FormikHelpers, useFormik } from 'formik';
import { useTranslation } from 'react-i18next';
import { object, string } from 'yup';
import { isOven } from '../../contracts/ctez';
import { useOvenData } from '../../api/queries';
import { useWallet } from '../../wallet/hooks';
import { CTEZ_ADDRESS } from '../../utils/globals';
import { addExternalOven, getExternalOvens } from '../../utils/ovenUtils';
import Button from '../button';
import { setExternalOvens } from '../../redux/slices/OvenSlice';
import { useAppDispatch } from '../../redux/store';
import { useThemeColors } from '../../hooks/utilHooks';

interface ITrackOvenProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IAddOvenForm {
  ovenAddress: string;
}

const TrackOven: React.FC<ITrackOvenProps> = ({ isOpen, onClose }) => {
  const [{ pkh: userAddress }] = useWallet();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const { t } = useTranslation(['common']);
  const [text2, inputbg, tabcolor] = useThemeColors(['text2', 'inputbg', 'tabcolor']);

  const initialValues: IAddOvenForm = {
    ovenAddress: '',
  };

  const ovenData = useOvenData(userAddress);
  const prevOvens = ovenData.data?.map((o) => o.address) ?? [];

  const validationSchema = object().shape({
    ovenAddress: string()
      .test({
        test: (value) => !!value && validateContractAddress(value) === 3,
        message: t('invalidAddress'),
      })
      .test({
        test: (value) => typeof value !== 'undefined' && !prevOvens.includes(value),
        message: t('ovenAlreadyExits'),
      })
      .required(t('required')),
  });

  const handleFormSubmit = async (
    { ovenAddress }: IAddOvenForm,
    formHelper: FormikHelpers<IAddOvenForm>,
  ) => {
    const isValidAddress = await isOven(ovenAddress);
    if (!isValidAddress) {
      toast({
        description: t('invalidOvenAddress'),
        status: 'error',
      });
    }
    if (userAddress && CTEZ_ADDRESS && isValidAddress) {
      addExternalOven(userAddress, CTEZ_ADDRESS, ovenAddress);
      if (!prevOvens.includes(ovenAddress)) {
        formHelper.resetForm();
        toast({
          description: t('ovenAddedSuccess'),
          status: 'success',
        });
        dispatch(setExternalOvens(getExternalOvens(userAddress, CTEZ_ADDRESS)));
        onClose();
      }
    }
  };

  const { values, handleChange, handleSubmit, ...formik } = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleFormSubmit,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader fontWeight="500" color={tabcolor}>
            {t('trackanOven')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl id="track-oven" w="100%">
              <FormLabel color={text2} fontWeight="500" fontSize="xs">
                {t('ovenAddress')}
              </FormLabel>
              <Input
                name="ovenAddress"
                id="ovenAddress"
                color={text2}
                bg={inputbg}
                value={values.ovenAddress}
                onChange={handleChange}
              />
            </FormControl>
          </ModalBody>

          <ModalFooter py={6}>
            <Button w="100%" type="submit" isLoading={formik.isSubmitting} walletGuard>
              {t('trackOven')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default TrackOven;
