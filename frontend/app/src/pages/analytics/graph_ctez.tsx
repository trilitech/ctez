import { Button, ButtonGroup, Flex, SkeletonText, Text, useMediaQuery } from "@chakra-ui/react";
import { format } from 'date-fns/fp';
import { graphic } from "echarts";
import React, { useMemo, useState } from "react";
import { useCtezGraphGQL } from "../../api/analytics";
  import { useThemeColors } from "../../hooks/utilHooks";
import { numberToMillionOrBillionFormate } from "../../utils/numberFormate";
import { ChartPure } from "./chart";

const color = '#0F62FF';
const color2 = '#38CB89';
const GraphCtez: React.FC = () => {
  const [textcolor] = useThemeColors(['homeTxt']);
  const [textHighlight] = useThemeColors(['sideBarBg']);
  const [largerScreen] = useMediaQuery(['(min-width: 900px)']);
  const [background, imported, text4] = useThemeColors([
    'cardbg2',
    'imported',
    'text4',
  ]);
  const { data: chartData = false } = useCtezGraphGQL();

  const [value, setValue] = useState<number | undefined>();
  const [time, setTime] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState('1m');

  // graph options
  const dateFormat = useMemo(() => format('MMM d, yyyy'), []);
  const dateFormat2 = useMemo(() => format('MMM, yyyy'), []);

  const option: React.ComponentProps<typeof ChartPure>['option'] = {
    dataset: [{
      dimensions: [
        { name: 'timestamp', displayName: '' },
        { name: 'current_avg_price', displayName: 'Avg Price' },
      ],
      source: chartData || []
    }, {
      dimensions: [
        { name: 'timestamp', displayName: '' },
        { name: 'ctez_sell_price', displayName: 'Sell Price' },
      ],
      source: chartData || []
    }, {
      dimensions: [
        { name: 'timestamp', displayName: '' },
        { name: 'ctez_buy_price', displayName: 'Buy Price' },
      ],
      source: chartData || []
    }, {
      dimensions: [
        { name: 'timestamp', displayName: '' },
        { name: 'target_price', displayName: 'Target Price' },
      ],
      source: chartData || []
    }],
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'time',
    },
    yAxis: {
      type: 'value',
      scale: true,
    },
    series: [{
      type: 'line',
      symbol: 'none',
      areaStyle: {
        color: new graphic.LinearGradient(0, 0, 1, 0, [
          {
            offset: 0,
            color: '#3260EF4D',
          },
          {
            offset: 1,
            color: '#3560ED14',
          }
        ])
      },
      color: '#0F62FF',
      datasetIndex: 0,
      smooth: true
    }, {
      type: 'line',
      symbol: 'none',
      color: 'red',
      datasetIndex: 1,
      smooth: true
    }, {
      type: 'line',
      symbol: 'none',
      color: 'yellow',
      datasetIndex: 2,
      smooth: true
    }, {
      type: 'line',
      symbol: 'none',
      color: '#38CB89',
      datasetIndex: 3,
      smooth: true
    }]
  };

  const lastValue = chartData && chartData[chartData.length - 1].current_avg_price;

  return (<Flex direction='column'
    borderRadius={16}
    backgroundColor={background}
    flex={1}
    paddingX={largerScreen ? '35px' : '19px'}
    paddingY={largerScreen ? '27px' : '24px'}
    gridGap={1}
  >
    <Flex justifyContent='space-between'>
      <div>
        <Text
          color={textcolor}
          fontSize={largerScreen ? '14px' : '14px'}
          lineHeight="29px"
          fontWeight={400}
        >
          Ctez Price
            </Text>
        <Flex flexDirection='column'>
          <Text
            color={textcolor}
            fontSize={largerScreen ? '32px' : '18px'}
            lineHeight="29px"
            fontWeight={600}
          >
            {(lastValue && !value) ? `${numberToMillionOrBillionFormate(lastValue, 6)} tez` : value ? `${numberToMillionOrBillionFormate(value, 6)} tez` : <SkeletonText pr={6} noOfLines={1} spacing="1" />}
          </Text>
          {time ? <Text fontSize='12px' >{activeTab === '1m' ? dateFormat(time) : dateFormat2(time)}</Text> : <Text fontSize='12px' opacity={0}>Time</Text>}
        </Flex>
      </div>
      <Flex flexDirection='column' align='flex-end' gridGap={2}>
        <ButtonGroup variant='ghost' gridGap={2} textColor={textcolor} fontSize='12px' spacing='-1'>
          <Button fontSize='12px' className={activeTab === '1m' ? "btnactive" : ''} textDecoration='underline' onClick={() => setActiveTab('1m')} >1M</Button>
          <Button fontSize='12px' className={activeTab === 'all' ? "btnactive" : ''} textDecoration='underline' onClick={() => setActiveTab('all')}>ALL</Button>
        </ButtonGroup>
      </Flex>

    </Flex>

    <ChartPure option={option} loading={!chartData} showZoom style={{ height: 300 }} />
  </Flex>)
}
export default GraphCtez;
