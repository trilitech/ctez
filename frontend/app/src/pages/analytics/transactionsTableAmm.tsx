import { Box, Button, ButtonGroup, Flex, Text, useMediaQuery } from "@chakra-ui/react";
import React, { useState } from "react";
import { useAddLiquidityTransactionsGql, useAddLiquidityTransactionTable, useDepositTransactionTable, useMintedTransactionTable, useOvenTransactionTable, useRemoveLiquidityTransactionTable, useSwapTransactionsGql, useSwapTransactionTable, useWithdrawTransactionTable } from "../../api/analytics";
import { useTableNumberUtils } from "../../hooks/useTableUtils";
import { useThemeColors } from "../../hooks/utilHooks";
import TableCommon, { ColData } from "./comonTable";


enum Transactiontype {
    Swaps = 'Swaps',
    Adds = 'Adds',
    Removes = 'Removes',
}

const TransactionTableAMM: React.FC = () => {
    const { positiveOrNegative, valueFormat } = useTableNumberUtils();
    const [textcolor] = useThemeColors(['homeTxt']);
    const [textHighlight] = useThemeColors(['sideBarBg']);
    const [largerScreen] = useMediaQuery(['(min-width: 900px)']);
    const [background, imported, text4] = useThemeColors([
        'cardbg2',
        'imported',
        'text4',
    ]);
    const { data: swapTransaction = [] } = useSwapTransactionsGql();
    const { data: addTransaction = [] } = useAddLiquidityTransactionsGql();
    const { data: removeTranscation = [] } = useRemoveLiquidityTransactionTable();

    const [transactionType, setTransactionType] = useState<Transactiontype>(Transactiontype.Swaps);
    const columSwap: ColData[] = [
        {
            accessor: 'Description',
            dataKey: 'description',
            isDescription: true,
            operationHashDataKey: 'transaction_hash'
        },
        {
            accessor: 'Amount X',
            dataKey: 'amount_xtz',
            isTez: true,
            isConsiderLogicChange: true,
        },
        {
            accessor: 'Amount Y',
            dataKey: 'amount_ctez',
            isCtez2: true,
            isConsiderLogicChange: true,
        },
        {
            accessor: 'Ctez Price',
            dataKey: 'price',
            isTez: true,
        },
        {
            accessor: 'Account',
            dataKey: 'account',
            isTrimAddress: true,
        },
        {
            accessor: 'Time',
            dataKey: 'timestamp',
            isTimeFormat: true
        }

    ]
    const columAdds: ColData[] = [
        {
            accessor: 'Description',
            dataKey: 'description',
            isDescriptionAdd: true,
            operationHashDataKey: 'transaction_hash'
        },
        {
            accessor: 'Amount',
            dataKey: 'self_amount',
            isTez: true,
            isConsiderLogicChange: true
        },
        {
            accessor: 'Account',
            dataKey: 'account',
            isTrimAddress: true,
        },
        {
            accessor: 'Time',
            dataKey: 'timestamp',
            isTimeFormat: true
        }
    ]

    const columRemoves: ColData[] = [
        {
            accessor: 'Description',
            dataKey: 'description',
            isDescriptionRemove: true,
        },
        {
            accessor: 'Amount',
            dataKey: 'quantityTk1',
            isTez: true,
        },
        {
            accessor: 'Amount',
            dataKey: 'quantityTk2',
            isCtez2: true,
        },
        {
            accessor: 'Account',
            dataKey: 'trader',
            isTrimAddress: true,
        },
        {
            accessor: 'Time',
            dataKey: 'timestamp',
            isTimeFormat: true
        }

    ]
    return (<Box
        backgroundColor={background}
        fontSize='14px'
        borderRadius={16}
        paddingX={largerScreen ? '35px' : '19px'}
        paddingY={largerScreen ? '27px' : '24px'}
    >
        <Flex justifyContent='space-between' wrap='wrap'>
            <Text
                color={textcolor}
                fontSize={largerScreen ? '20px' : '16px'}
                lineHeight="29px"
                fontWeight={600}
            >
                Transactions
            </Text>
            <ButtonGroup variant='ghost' textColor={textcolor} spacing='-1' gridGap={2}>
                <Button fontSize='12px' textDecoration='underline' onClick={() => setTransactionType(Transactiontype.Swaps)} className={transactionType === Transactiontype.Swaps ? 'btnactive' : ''} >Swaps</Button>
                <Button fontSize='12px' textDecoration='underline' onClick={() => setTransactionType(Transactiontype.Adds)} className={transactionType === Transactiontype.Adds ? 'btnactive' : ''}>Adds</Button>
                <Button fontSize='12px' textDecoration='underline' onClick={() => setTransactionType(Transactiontype.Removes)} className={transactionType === Transactiontype.Removes ? 'btnactive' : ''}>Removes</Button>
            </ButtonGroup>

        </Flex>
        {transactionType === Transactiontype.Swaps && <TableCommon column={columSwap} data={swapTransaction} />}
        {transactionType === Transactiontype.Adds && <TableCommon column={columAdds} data={addTransaction} />}
        {transactionType === Transactiontype.Removes && <TableCommon column={columRemoves} data={removeTranscation} />}


    </Box>)
}
export default TransactionTableAMM;
