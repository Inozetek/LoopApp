/**
 * LoopRouteIcon Tests (unit, no render)
 *
 * Verifies the component module exports correctly and uses expected props.
 */

// Mock react-native-svg to prevent import errors
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  Circle: 'Circle',
}));

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s: any) => s },
}));

import { LoopRouteIcon } from '@/components/ui/loop-route-icon';

describe('LoopRouteIcon', () => {
  it('exports a function component', () => {
    expect(typeof LoopRouteIcon).toBe('function');
  });

  it('accepts size and color props', () => {
    const element = LoopRouteIcon({ size: 24, color: '#FF0000' });
    expect(element).toBeTruthy();
    expect(element.props.width).toBe(24);
    expect(element.props.height).toBe(24);
  });

  it('uses default size=20 and color=#FFFFFF', () => {
    const element = LoopRouteIcon({});
    expect(element.props.width).toBe(20);
    expect(element.props.height).toBe(20);
  });

  it('renders Path + Circle children (blob outline + stop nodes)', () => {
    const element = LoopRouteIcon({ size: 20, color: '#000', stops: 4 });
    const children = element.props.children;
    expect(Array.isArray(children)).toBe(true);
    // children = [Path element, [Circle, Circle, Circle, Circle]]
    expect(children.length).toBe(2);
    // First child is the blob path
    expect(children[0]).toBeTruthy();
    // Second child is the array of stop-node circles
    expect(Array.isArray(children[1])).toBe(true);
    expect(children[1].length).toBe(4);
  });

  it('passes color as stroke to path and fill to circles', () => {
    const element = LoopRouteIcon({ size: 20, color: 'red' });
    const children = element.props.children;
    // Path has stroke=color
    expect(children[0].props.stroke).toBe('red');
    // Circles have fill=color
    children[1].forEach((circle: any) => {
      expect(circle.props.fill).toBe('red');
    });
  });

  it('top and right nodes have larger radius for visual balance', () => {
    const element = LoopRouteIcon({ size: 20, color: '#000', stops: 5 });
    const circles = element.props.children[1];
    // Top (index 0) and right (index 1) should be 3.2
    expect(circles[0].props.r).toBe(3.2);
    expect(circles[1].props.r).toBe(3.2);
    // Bottom and left nodes should be 2.8
    expect(circles[2].props.r).toBe(2.8);
    expect(circles[3].props.r).toBe(2.8);
    expect(circles[4].props.r).toBe(2.8);
  });

  it('respects stops prop to limit node count', () => {
    const el3 = LoopRouteIcon({ size: 16, color: '#FFF', stops: 3 });
    expect(el3.props.children[1].length).toBe(3);

    const el2 = LoopRouteIcon({ size: 16, color: '#FFF', stops: 2 });
    expect(el2.props.children[1].length).toBe(2);
  });
});
