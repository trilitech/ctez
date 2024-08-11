import { Button, ButtonGroup, Flex, Skeleton, SkeletonText, Text, useMediaQuery } from "@chakra-ui/react";
import React, { useMemo, useState } from "react";
import { format } from 'date-fns/fp';
import { graphic } from "echarts";
import { ChartPure } from "./chart";
import { useCtezGraphGql, useDriftGraph, useDriftGraphAll } from "../../api/analytics";
import { useThemeColors } from "../../hooks/utilHooks";
import { numberToMillionOrBillionFormate } from "../../utils/numberFormate";

const GraphDrift: React.FC = () => {
  const [textcolor] = useThemeColors(['homeTxt']);
  const [textHighlight] = useThemeColors(['sideBarBg']);
  const [largerScreen] = useMediaQuery(['(min-width: 900px)']);
  const [background, imported, text4] = useThemeColors([
    'cardbg2',
    'imported',
    'text4',
  ]);
  const { data: chartData = false } = useCtezGraphGql();
  const [value, setValue] = useState<number | undefined>();
  const [time, setTime] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState('1m');
  // graph options
  const dateFormat = useMemo(() => format('MMM d, yyyy'), []);
  const dateFormat2 = useMemo(() => format('MMM, yyyy'), []);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(endDate.getMonth() - 1);

  const option: React.ComponentProps<typeof ChartPure>['option'] = {
    dataset: [{
      dimensions: [
        { name: 'timestamp', displayName: '' },
        { name: 'current_annual_drift', displayName: 'Annual Drift' },
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
    }]
  };

  const lastValue = chartData && chartData[chartData.length - 1].current_annual_drift;

  return (<Flex direction='column'
    borderRadius={16}
    backgroundColor={background}
    flexGrow={1}
    flexShrink={1}
    flexBasis={320}
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
          Annual Drift
            </Text>
        <Flex flexDirection='column'>
          <Text
            color={textcolor}
            fontSize={largerScreen ? '32px' : '18px'}
            lineHeight="29px"
            fontWeight={600}
          >
            {(lastValue && !value) ? `${numberToMillionOrBillionFormate(lastValue, 2)} %` : value ? `${numberToMillionOrBillionFormate(value, 2)} %` : <SkeletonText pr={6} noOfLines={1} spacing="1" />}
          </Text>
          {time ? <Text fontSize='12px' >{activeTab === '1m' ? dateFormat(time) : dateFormat2(time)}</Text> : <Text fontSize='12px' opacity={0}>Time</Text>}
        </Flex>
      </div>

      <ButtonGroup variant='ghost' gridGap={2} textColor={textcolor} fontSize='12px' spacing='-1'>
        <Button fontSize='12px' className={activeTab === '1m' ? "btnactive" : ''} textDecoration='underline' onClick={() => setActiveTab('1m')} >1M</Button>
        <Button fontSize='12px' className={activeTab === 'all' ? "btnactive" : ''} textDecoration='underline' onClick={() => setActiveTab('all')}>ALL</Button>
      </ButtonGroup>
    </Flex>
    {chartData
      ? <ChartPure
        option={option}
        showZoom
        zoomStartDate={activeTab === '1m' ? startDate : undefined}
        zoomEndDate={activeTab === '1m' ? endDate : undefined}
        style={{ height: 300 }} />
      : <Skeleton height='300px' minWidth='20px' />}
  </Flex>)
}
export default GraphDrift;

