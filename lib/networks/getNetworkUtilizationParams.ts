export default function getNetworkUtilizationParams(value: number) {
  const load = (() => {
    if (value > 80) {
      return 'high';
    }

    if (value > 50) {
      return 'medium';
    }

    return 'low';
  })();

  const colors = {
    high: 'green.500',
    medium: 'green.500',
    low: 'green.500',
  };
  const color = colors[load];

  return {
    load,
    color,
  };
}
