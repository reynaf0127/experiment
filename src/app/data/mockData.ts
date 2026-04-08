export interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'completed' | 'paused';
  startDate: string;
  endDate?: string;
  control: {
    name: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  variant: {
    name: string;
    visitors: number;
    conversions: number;
    conversionRate: number;
  };
  improvement: number;
  confidence: number;
  isSignificant: boolean;
  metric: string;
  dailyData: Array<{
    date: string;
    controlConversions: number;
    variantConversions: number;
    controlVisitors: number;
    variantVisitors: number;
  }>;
}

export const mockABTests: ABTest[] = [
  {
    id: '1',
    name: 'Homepage CTA Button Color',
    description: 'Testing blue vs. green call-to-action button on homepage',
    status: 'running',
    startDate: '2026-03-15',
    metric: 'Click-through Rate',
    control: {
      name: 'Blue Button',
      visitors: 12453,
      conversions: 1867,
      conversionRate: 14.99,
    },
    variant: {
      name: 'Green Button',
      visitors: 12389,
      conversions: 2103,
      conversionRate: 16.98,
    },
    improvement: 13.28,
    confidence: 98.5,
    isSignificant: true,
    dailyData: [
      { date: '03/15', controlConversions: 124, variantConversions: 142, controlVisitors: 831, variantVisitors: 825 },
      { date: '03/16', controlConversions: 118, variantConversions: 138, controlVisitors: 788, variantVisitors: 792 },
      { date: '03/17', controlConversions: 131, variantConversions: 149, controlVisitors: 874, variantVisitors: 869 },
      { date: '03/18', controlConversions: 127, variantConversions: 145, controlVisitors: 847, variantVisitors: 854 },
      { date: '03/19', controlConversions: 135, variantConversions: 153, controlVisitors: 901, variantVisitors: 896 },
      { date: '03/20', controlConversions: 129, variantConversions: 147, controlVisitors: 861, variantVisitors: 867 },
      { date: '03/21', controlConversions: 133, variantConversions: 151, controlVisitors: 887, variantVisitors: 881 },
      { date: '03/22', controlConversions: 126, variantConversions: 144, controlVisitors: 841, variantVisitors: 848 },
      { date: '03/23', controlConversions: 140, variantConversions: 158, controlVisitors: 934, variantVisitors: 928 },
      { date: '03/24', controlConversions: 132, variantConversions: 150, controlVisitors: 881, variantVisitors: 875 },
      { date: '03/25', controlConversions: 138, variantConversions: 156, controlVisitors: 921, variantVisitors: 915 },
      { date: '03/26', controlConversions: 125, variantConversions: 143, controlVisitors: 834, variantVisitors: 841 },
      { date: '03/27', controlConversions: 136, variantConversions: 154, controlVisitors: 907, variantVisitors: 901 },
      { date: '03/28', controlConversions: 130, variantConversions: 148, controlVisitors: 867, variantVisitors: 873 },
      { date: '03/29', controlConversions: 143, variantConversions: 161, controlVisitors: 954, variantVisitors: 948 },
    ],
  },
  {
    id: '2',
    name: 'Pricing Page Layout',
    description: 'Comparing horizontal vs. vertical pricing card layout',
    status: 'completed',
    startDate: '2026-02-20',
    endDate: '2026-03-20',
    metric: 'Sign-up Conversion',
    control: {
      name: 'Horizontal Layout',
      visitors: 8932,
      conversions: 892,
      conversionRate: 9.99,
    },
    variant: {
      name: 'Vertical Layout',
      visitors: 8876,
      conversions: 1064,
      conversionRate: 11.99,
    },
    improvement: 20.02,
    confidence: 99.2,
    isSignificant: true,
    dailyData: [
      { date: '02/20', controlConversions: 31, variantConversions: 38, controlVisitors: 312, variantVisitors: 308 },
      { date: '02/21', controlConversions: 29, variantConversions: 35, controlVisitors: 290, variantVisitors: 294 },
      { date: '02/22', controlConversions: 32, variantConversions: 39, controlVisitors: 320, variantVisitors: 316 },
      { date: '02/23', controlConversions: 30, variantConversions: 36, controlVisitors: 300, variantVisitors: 304 },
      { date: '02/24', controlConversions: 28, variantConversions: 34, controlVisitors: 280, variantVisitors: 284 },
      { date: '02/25', controlConversions: 33, variantConversions: 40, controlVisitors: 330, variantVisitors: 326 },
      { date: '02/26', controlConversions: 31, variantConversions: 37, controlVisitors: 310, variantVisitors: 314 },
      { date: '02/27', controlConversions: 29, variantConversions: 35, controlVisitors: 290, variantVisitors: 294 },
    ],
  },
  {
    id: '3',
    name: 'Product Page Image Gallery',
    description: 'Testing single large image vs. multi-image carousel',
    status: 'completed',
    startDate: '2026-03-01',
    endDate: '2026-03-25',
    metric: 'Add to Cart Rate',
    control: {
      name: 'Single Image',
      visitors: 15234,
      conversions: 2133,
      conversionRate: 14.00,
    },
    variant: {
      name: 'Image Carousel',
      visitors: 15189,
      conversions: 2126,
      conversionRate: 14.00,
    },
    improvement: 0.0,
    confidence: 12.3,
    isSignificant: false,
    dailyData: [
      { date: '03/01', controlConversions: 89, variantConversions: 88, controlVisitors: 635, variantVisitors: 632 },
      { date: '03/02', controlConversions: 87, variantConversions: 86, controlVisitors: 621, variantVisitors: 618 },
      { date: '03/03', controlConversions: 91, variantConversions: 90, controlVisitors: 650, variantVisitors: 646 },
      { date: '03/04', controlConversions: 85, variantConversions: 84, controlVisitors: 607, variantVisitors: 604 },
      { date: '03/05', controlConversions: 88, variantConversions: 87, controlVisitors: 629, variantVisitors: 625 },
    ],
  },
  {
    id: '4',
    name: 'Email Subject Line Test',
    description: 'Testing personalized vs. generic subject lines',
    status: 'running',
    startDate: '2026-03-22',
    metric: 'Email Open Rate',
    control: {
      name: 'Generic Subject',
      visitors: 5234,
      conversions: 1361,
      conversionRate: 26.00,
    },
    variant: {
      name: 'Personalized Subject',
      visitors: 5198,
      conversions: 1612,
      conversionRate: 31.01,
    },
    improvement: 19.27,
    confidence: 95.8,
    isSignificant: true,
    dailyData: [
      { date: '03/22', controlConversions: 171, variantConversions: 203, controlVisitors: 658, variantVisitors: 654 },
      { date: '03/23', controlConversions: 168, variantConversions: 200, controlVisitors: 646, variantVisitors: 642 },
      { date: '03/24', controlConversions: 175, variantConversions: 207, controlVisitors: 673, variantVisitors: 669 },
      { date: '03/25', controlConversions: 170, variantConversions: 202, controlVisitors: 654, variantVisitors: 650 },
      { date: '03/26', controlConversions: 173, variantConversions: 205, controlVisitors: 665, variantVisitors: 661 },
      { date: '03/27', controlConversions: 169, variantConversions: 201, controlVisitors: 650, variantVisitors: 646 },
      { date: '03/28', controlConversions: 176, variantConversions: 208, controlVisitors: 677, variantVisitors: 673 },
      { date: '03/29', controlConversions: 172, variantConversions: 204, controlVisitors: 662, variantVisitors: 658 },
    ],
  },
  {
    id: '5',
    name: 'Checkout Process Steps',
    description: 'One-page checkout vs. multi-step checkout flow',
    status: 'paused',
    startDate: '2026-03-10',
    metric: 'Checkout Completion',
    control: {
      name: 'Multi-step',
      visitors: 3421,
      conversions: 2225,
      conversionRate: 65.03,
    },
    variant: {
      name: 'One-page',
      visitors: 3398,
      conversions: 2107,
      conversionRate: 62.01,
    },
    improvement: -4.65,
    confidence: 87.2,
    isSignificant: false,
    dailyData: [
      { date: '03/10', controlConversions: 111, variantConversions: 104, controlVisitors: 171, variantVisitors: 169 },
      { date: '03/11', controlConversions: 109, variantConversions: 102, controlVisitors: 168, variantVisitors: 166 },
      { date: '03/12', controlConversions: 113, variantConversions: 106, controlVisitors: 174, variantVisitors: 172 },
      { date: '03/13', controlConversions: 110, variantConversions: 103, controlVisitors: 169, variantVisitors: 167 },
      { date: '03/14', controlConversions: 112, variantConversions: 105, controlVisitors: 172, variantVisitors: 170 },
    ],
  },
];
