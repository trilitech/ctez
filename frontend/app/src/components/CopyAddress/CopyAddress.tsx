import React, { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, Flex, Box, useToast } from '@chakra-ui/react';
import { MdContentCopy } from 'react-icons/md';
import { useThemeColors } from '../../hooks/utilHooks';

export interface Props {
  address: string;
  placement?: 'left' | 'right';
  spaced?: boolean;
}

const CopyAddress: React.FC<Props> = ({ children, address, placement, spaced }) => {
  const toast = useToast();
  const [cardbg] = useThemeColors(['cardbg']);
  const { t } = useTranslation(['common']);

  function onClickCopy(e: ReactMouseEvent<SVGElement, MouseEvent>) {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(address).then(() =>
      toast({
        position: 'bottom',
        render() {
          return (
            <Flex borderRadius={14} background={cardbg}>
              <Text m="auto">{t('copiedtoclipboard')}</Text>
            </Flex>
          );
        },
      }),
    );
  }

  return (
    <Box>
      {address && (
        <Flex
          alignItems="center"
          justify={spaced ? 'space-between' : 'normal'}
          flexDirection={placement === 'left' ? 'row-reverse' : 'row'}
        >
          {children && children}
          <Flex
            mr={children && placement === 'left' ? 1 : 0}
            ml={children && placement === 'right' ? 1 : 0}
          >
            <MdContentCopy
              cursor="pointer"
              onClick={(event) => {
                onClickCopy(event);
              }}
            />
          </Flex>
        </Flex>
      )}
    </Box>
  );
};

const defaultProps: Props = {
  address: '',
  placement: 'right',
  spaced: false,
};

CopyAddress.defaultProps = defaultProps;

export { CopyAddress };
