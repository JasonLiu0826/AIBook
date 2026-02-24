import Taro from '@tarojs/taro';

/**
 * 获取设备安全区域信息
 * 企业级安全区处理，兼容各种异形屏设备
 */
export const getSafeArea = () => {
  try {
    const info = Taro.getSystemInfoSync();
    const safeArea = info.safeArea;
    
    // 计算底部安全区高度
    const bottomInset = safeArea ? info.screenHeight - safeArea.bottom : 0;
    // 计算顶部安全区高度（状态栏高度）
    const topInset = info.statusBarHeight || 44;
    
    return {
      // 底部安全区：优先使用系统返回值，兜底20px
      bottom: bottomInset > 0 ? bottomInset : 20,
      // 顶部安全区：适配刘海屏等异形屏
      top: topInset,
      // 设备信息
      devicePixelRatio: info.pixelRatio,
      windowWidth: info.windowWidth,
      windowHeight: info.windowHeight,
      screenWidth: info.screenWidth,
      screenHeight: info.screenHeight,
      isIOS: info.platform === 'ios',
      isAndroid: info.platform === 'android'
    };
  } catch (error) {
    console.warn('获取安全区信息失败，使用默认值:', error);
    // 完整的兜底方案
    return {
      bottom: 20,
      top: 44,
      devicePixelRatio: 2,
      windowWidth: 375,
      windowHeight: 667,
      screenWidth: 375,
      screenHeight: 667,
      isIOS: false,
      isAndroid: true
    };
  }
};

/**
 * 获取适配后的底部内边距
 * 结合安全区和设计稿基准进行计算
 */
export const getAdaptivePaddingBottom = (basePadding: number = 20): string => {
  const { bottom } = getSafeArea();
  // 将rpx转换为px进行计算，再转回rpx
  const basePx = (basePadding * 2); // 假设设计稿基准为375px
  const totalPaddingPx = basePx + bottom;
  const totalPaddingRpx = Math.round(totalPaddingPx / 2);
  return `${totalPaddingRpx}rpx`;
};

/**
 * 判断是否为大屏设备（平板/折叠屏）
 */
export const isLargeScreen = (): boolean => {
  const { windowWidth } = getSafeArea();
  // 以768px为界判断大屏设备
  return windowWidth >= 768;
};

/**
 * 获取适配的最大宽度
 * 解决大屏设备UI过度拉伸问题
 */
export const getMaxWidth = (): string => {
  return isLargeScreen() ? '600px' : '100vw';
};

/**
 * 获取设备类型标识
 */
export const getDeviceType = (): 'phone' | 'tablet' | 'desktop' => {
  const { windowWidth } = getSafeArea();
  if (windowWidth >= 1024) return 'desktop';
  if (windowWidth >= 768) return 'tablet';
  return 'phone';
};

/**
 * 性能检测：判断是否为低端设备
 */
export const isLowEndDevice = (): boolean => {
  const { devicePixelRatio, windowWidth, windowHeight } = getSafeArea();
  const screenArea = windowWidth * windowHeight;
  // 像素密度低且屏幕尺寸小的设备视为低端
  return devicePixelRatio < 2 && screenArea < 300000;
};