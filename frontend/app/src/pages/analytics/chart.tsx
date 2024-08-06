import { init, getInstanceByDom, EChartsOption, ECharts, SetOptionOpts } from 'echarts';
import React, { useRef, useEffect, CSSProperties, useMemo } from 'react';
import clsx from 'clsx'
import { useColorMode } from '@chakra-ui/react';

interface ChartProps {
  option: EChartsOption;
  className?: string;
  style?: CSSProperties;
  settings?: SetOptionOpts;
  loading?: boolean;
  title?: string;
  showZoom?: boolean;
}

export const Chart = (props: ChartProps) => {
  const { colorMode } = useColorMode();
  const chartElRef = useRef<HTMLDivElement>(null);
  const theme = colorMode === 'dark' ? 'dark' : 'light';

  const option = useMemo(() => {
    const showZoom = props.showZoom === undefined || props.showZoom;

    return {
      backgroundColor: 'transparent',
      title: {
        text: props.title,
        padding: 0,
      },
      dataZoom: showZoom ? [{
        type: 'inside',
        filterMode: 'none'
      }, {
        type: 'slider',
        filterMode: 'none'
      }] : undefined,
      ...props.option,
      grid: {
        top: 45,
        left: 'left',
        right: 0,
        containLabel: true,
        ...(!showZoom && { bottom: 0 }),
        ...props.option.grid
      },
      legend: {
        top: 0,
        left: 'left',
        padding: 0,
        type: 'scroll',
        ...props.option.legend
      },
    };
  }, [props.option, props.showZoom, props.title]);

  useEffect(() => {
    let chart: ECharts | undefined;
    if (chartElRef.current) {
      chart = init(chartElRef.current, theme);
    }

    const handleResize = () => {
      chart?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart?.dispose();
    };
  }, [theme]);

  useEffect(() => {
    if (chartElRef.current) {
      const chart = getInstanceByDom(chartElRef.current);
      chart?.setOption(option, props.settings);
    }
  }, [option, props.settings, theme]);

  useEffect(() => {
    if (chartElRef.current) {
      const chart = getInstanceByDom(chartElRef.current);
      props.loading === true ? chart?.showLoading() : chart?.hideLoading();
    }
  }, [props.loading, theme]);

  return <div className={clsx('chart-container', props.className)} ref={chartElRef} style={{ width: '100%', height: '100%', ...props.style }} />;
};

export const ChartPure = React.memo(Chart);
