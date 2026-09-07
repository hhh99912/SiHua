import { DatasetItem, ScadaDeviceItem, DatasetField } from '../types';

// Helper to flatten device data for fast key-value lookups & chart compatibility
export function syncFlatDataFromDevices(devices: ScadaDeviceItem[]): { data: Record<string, any>; fields: DatasetField[] } {
  const data: Record<string, any> = {
    timestamp: new Date().toLocaleTimeString()
  };
  const fields: DatasetField[] = [];

  devices.forEach(dev => {
    // Communication status
    const commKey = `${dev.deviceId}_comm`;
    data[commKey] = dev.commStatus;
    fields.push({
      name: commKey,
      type: 'number',
      label: `[${dev.deviceId}] ${dev.deviceName} 通信状态 (0/1/2)`,
      sample: dev.commStatus
    });

    // 1. 遥测 (YC)
    dev.telemetries?.forEach(yc => {
      const key = `${dev.deviceId}_YC_${yc.pointId}`;
      data[key] = yc.value;
      fields.push({
        name: key,
        type: 'number',
        label: `[${dev.deviceId} 遥测.${yc.pointId}] ${yc.name} (${yc.unit})`,
        sample: yc.value
      });
    });

    // 2. 遥信 (YX - 0, 1, 2)
    dev.teleSignals?.forEach(yx => {
      const key = `${dev.deviceId}_YX_${yx.pointId}`;
      data[key] = yx.value;
      fields.push({
        name: key,
        type: 'number',
        label: `[${dev.deviceId} 遥信.${yx.pointId}] ${yx.name} (0/1/2)`,
        sample: yx.value
      });
    });

    // 3. 电度 (DD)
    dev.energies?.forEach(dd => {
      const key = `${dev.deviceId}_DD_${dd.pointId}`;
      data[key] = dd.value;
      fields.push({
        name: key,
        type: 'number',
        label: `[${dev.deviceId} 电度.${dd.pointId}] ${dd.name} (${dd.unit})`,
        sample: dd.value
      });
    });

    // 4. 遥调 (YT)
    dev.teleRegulations?.forEach(yt => {
      const key = `${dev.deviceId}_YT_${yt.pointId}`;
      data[key] = yt.value;
      fields.push({
        name: key,
        type: 'number',
        label: `[${dev.deviceId} 遥调.${yt.pointId}] ${yt.name} (${yt.unit})`,
        sample: yt.value
      });
    });
  });

  // Global Series for ECharts
  data['series_time'] = ['10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30', '10:35', '10:40', '10:45'];
  data['series_power'] = [6800, 7100, 7450, 7620, 7580, 7620.5, 7700, 7650, 7590, 7620.5];
  data['series_voltage'] = [10.21, 10.23, 10.25, 10.26, 10.24, 10.25, 10.27, 10.26, 10.25, 10.25];
  data['series_device_load'] = [76.2, 64.5, 32.0, 48.6, 82.5];
  data['series_device_names'] = ['101进线', '1#主变', '100母联', '201低压', '301光伏'];

  return { data, fields };
}

// Preset Device Configurations
export const STATION_DEVICES: ScadaDeviceItem[] = [
  {
    deviceId: 'DEV-101',
    deviceName: '10kV 进线 101 测控保护装置',
    deviceType: '线路测控保护单元',
    commStatus: 1,
    ipAddress: '192.168.1.101',
    telemetries: [
      { pointId: 1, name: 'A相电压 Ua', factor: 0.1, unit: 'kV', rawValue: 102.5, value: 10.25, description: '10kV母线A相对地电压' },
      { pointId: 2, name: 'B相电压 Ub', factor: 0.1, unit: 'kV', rawValue: 102.8, value: 10.28, description: '10kV母线B相对地电压' },
      { pointId: 3, name: 'C相电压 Uc', factor: 0.1, unit: 'kV', rawValue: 102.2, value: 10.22, description: '10kV母线C相对地电压' },
      { pointId: 4, name: 'A相电流 Ia', factor: 1.0, unit: 'A', rawValue: 428.6, value: 428.6, description: '101进线A相进线电流' },
      { pointId: 5, name: 'B相电流 Ib', factor: 1.0, unit: 'A', rawValue: 425.1, value: 425.1, description: '101进线B相进线电流' },
      { pointId: 6, name: 'C相电流 Ic', factor: 1.0, unit: 'A', rawValue: 431.2, value: 431.2, description: '101进线C相进线电流' },
      { pointId: 7, name: '有功功率 P', factor: 1.0, unit: 'kW', rawValue: 7620.5, value: 7620.5, description: '101三相总有功功率' },
      { pointId: 8, name: '无功功率 Q', factor: 1.0, unit: 'kvar', rawValue: 1210.4, value: 1210.4, description: '101三相总无功功率' },
      { pointId: 9, name: '功率因数 CosΦ', factor: 0.01, unit: '', rawValue: 98, value: 0.98, description: '101综合功率因数' },
      { pointId: 10, name: '电网频率 F', factor: 0.01, unit: 'Hz', rawValue: 5002, value: 50.02, description: '系统电网工频频率' }
    ],
    teleSignals: [
      { pointId: 1, name: '101 断路器位置 (0:分/1:合/2:跳)', value: 1, statusText: '合闸 (1)', description: '101真空断路器主触头常开辅助触点' },
      { pointId: 2, name: '101 手车工作位置 (0:试/1:工/2:检)', value: 1, statusText: '工作位置 (1)', description: '可抽出式手车在工作试验位置' },
      { pointId: 3, name: '101 隔离开关位置 (0:分/1:合/2:障)', value: 1, statusText: '合闸 (1)', description: '母线侧隔离刀闸位置' },
      { pointId: 4, name: '101 接地刀闸位置 (0:分/1:合/2:障)', value: 0, statusText: '分闸 (0)', description: '线路侧接地刀闸位置' },
      { pointId: 5, name: '101 保护事故总跳闸 (0:常/1:动/2:障)', value: 0, statusText: '正常 (0)', description: '微机保护速断过流动作出口' },
      { pointId: 6, name: '101 机构弹簧未储能 (0:已储/1:未储/2:障)', value: 0, statusText: '正常已储能 (0)', description: '断路器操动机构储能状态' },
      { pointId: 7, name: '101 重合闸动作 (0:复归/1:动作/2:闭锁)', value: 0, statusText: '未动作 (0)', description: '一次自动重合闸动作指示' }
    ],
    energies: [
      { pointId: 1, name: '正向有功总电能', factor: 0.01, unit: 'kWh', value: 284560.8, description: '电度表双向累计正向有功电量' },
      { pointId: 2, name: '正向无功总电能', factor: 0.01, unit: 'kvarh', value: 42150.3, description: '累计无功电能' },
      { pointId: 3, name: '今日累计用电量', factor: 1.0, unit: 'kWh', value: 18450.0, description: '当日零点起算累计能耗' }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '101 断路器分合闸控制',
        targetPointId: 1,
        options: [
          { label: '分闸指令 (0)', value: 0 },
          { label: '合闸指令 (1)', value: 1 }
        ]
      },
      {
        pointId: 2,
        name: '101 自动重合闸压板投退',
        options: [
          { label: '退出压板 (0)', value: 0 },
          { label: '投入压板 (1)', value: 1 }
        ]
      },
      {
        pointId: 3,
        name: '101 保护信号远方复归',
        options: [
          { label: '复归信号 (0)', value: 0 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '101 过流一段动作电流定值', unit: 'A', min: 100, max: 1500, step: 10, value: 650 },
      { pointId: 2, name: '101 过流一段动作时限', unit: 's', min: 0.0, max: 5.0, step: 0.05, value: 0.5 }
    ]
  },
  {
    deviceId: 'DEV-102',
    deviceName: '1# 主变压器 102 测控保护装置',
    deviceType: '主变压器双绕组保护测控',
    commStatus: 1,
    ipAddress: '192.168.1.102',
    telemetries: [
      { pointId: 1, name: '主变高压侧电流', factor: 1.0, unit: 'A', rawValue: 245.0, value: 245.0, description: '110kV/10kV高压侧线电流' },
      { pointId: 2, name: '主变低压侧电流', factor: 1.0, unit: 'A', rawValue: 1280.5, value: 1280.5, description: '10kV侧总输出电流' },
      { pointId: 3, name: '主变顶层油温', factor: 1.0, unit: '℃', rawValue: 56.4, value: 56.4, description: 'PT100油面温度传感器测值' },
      { pointId: 4, name: '主变绕组热点温度', factor: 1.0, unit: '℃', rawValue: 68.2, value: 68.2, description: '主变三相绕组最高发热点' },
      { pointId: 5, name: '主变负荷率', factor: 1.0, unit: '%', rawValue: 64.5, value: 64.5, description: '当前出力/额定容量占比' }
    ],
    teleSignals: [
      { pointId: 1, name: '主变高压侧断路器 (0:分/1:合/2:跳)', value: 1, statusText: '合闸 (1)' },
      { pointId: 2, name: '主变低压侧断路器 (0:分/1:合/2:跳)', value: 1, statusText: '合闸 (1)' },
      { pointId: 3, name: '主变重瓦斯保护跳闸 (0:常/1:动/2:障)', value: 0, statusText: '正常 (0)' },
      { pointId: 4, name: '主变轻瓦斯告警 (0:常/1:动/2:障)', value: 0, statusText: '正常 (0)' },
      { pointId: 5, name: '主变风冷系统运行 (0:停/1:运/2:障)', value: 1, statusText: '运行 (1)' }
    ],
    energies: [
      { pointId: 1, name: '主变供电量累计', factor: 0.01, unit: 'MWh', value: 5240.2 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '主变冷却风机启停控制',
        targetPointId: 5, // 关联 YX_5 主变风冷系统运行
        options: [
          { label: '风机停止 (0)', value: 0 },
          { label: '风机启动 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '有载调压分接头档位', unit: '档', min: 1, max: 17, step: 1, value: 9, targetYcPointId: 1 },
      { pointId: 2, name: '冷却风机自启温控阈值', unit: '℃', min: 40, max: 80, step: 1, value: 55, targetYcPointId: 3 }
    ]
  },
  {
    deviceId: 'DEV-103',
    deviceName: '10kV 母联 100 测控备自投装置',
    deviceType: '母联测控与备自投单元',
    commStatus: 1,
    ipAddress: '192.168.1.103',
    telemetries: [
      { pointId: 1, name: '母联电流', factor: 1.0, unit: 'A', rawValue: 0.0, value: 0.0 },
      { pointId: 2, name: 'I段母线电压', factor: 0.1, unit: 'kV', rawValue: 102.5, value: 10.25 },
      { pointId: 3, name: 'II段母线电压', factor: 0.1, unit: 'kV', rawValue: 102.6, value: 10.26 }
    ],
    teleSignals: [
      { pointId: 1, name: '100 母联断路器 (0:分/1:合/2:跳)', value: 0, statusText: '分闸备用 (0)' },
      { pointId: 2, name: '备自投装置就绪 (0:未就绪/1:就绪/2:闭锁)', value: 1, statusText: '就绪 (1)' },
      { pointId: 3, name: '备自投自锁动作 (0:复归/1:动作/2:障)', value: 0, statusText: '正常 (0)' }
    ],
    energies: [
      { pointId: 1, name: '母联累计转移电量', factor: 0.01, unit: 'kWh', value: 120.0 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '100 母联断路器分合遥控',
        targetPointId: 1,
        options: [
          { label: '分闸指令 (0)', value: 0 },
          { label: '合闸指令 (1)', value: 1 }
        ]
      },
      {
        pointId: 2,
        name: '备自投功能远方投退',
        options: [
          { label: '退出备自投 (0)', value: 0 },
          { label: '投入备自投 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '备自投无压判定延时', unit: 's', min: 0.5, max: 5.0, step: 0.1, value: 1.5 }
    ]
  },
  {
    deviceId: 'DEV-201',
    deviceName: '400V 低压综合配电 201 测控单元',
    deviceType: '低压智能配电与电能质量',
    commStatus: 1,
    ipAddress: '192.168.2.201',
    telemetries: [
      { pointId: 1, name: '低压Uab线电压', factor: 1.0, unit: 'V', rawValue: 382.4, value: 382.4 },
      { pointId: 2, name: '低压三相总负荷电流', factor: 1.0, unit: 'A', rawValue: 840.5, value: 840.5 },
      { pointId: 3, name: '低压总有功功率', factor: 1.0, unit: 'kW', rawValue: 520.4, value: 520.4 },
      { pointId: 4, name: '低压电缆接头温度', factor: 1.0, unit: '℃', rawValue: 43.8, value: 43.8 },
      { pointId: 5, name: '电网无功功率', factor: 1.0, unit: 'kvar', rawValue: 85.0, value: 85.0 }
    ],
    teleSignals: [
      { pointId: 1, name: '低压主进线断路器 (0:分/1:合/2:跳)', value: 1, statusText: '合闸 (1)' },
      { pointId: 2, name: '电容无功自动补偿投入 (0:切除/1:投入/2:障)', value: 1, statusText: '投入 (1)' },
      { pointId: 3, name: '低压母线过温告警 (0:常/1:动/2:障)', value: 0, statusText: '正常 (0)' }
    ],
    energies: [
      { pointId: 1, name: '低压总用电量累计', factor: 0.01, unit: 'kWh', value: 98450.0 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '电容补偿柜投切模式',
        options: [
          { label: '手动模式 (0)', value: 0 },
          { label: '自动模式 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '目标功率因数补偿设定', unit: '', min: 0.85, max: 0.99, step: 0.01, value: 0.96 }
    ]
  },
  {
    deviceId: 'DEV-301',
    deviceName: '厂区分布式光伏并网 301 测控逆变装置',
    deviceType: '光伏逆变与防孤岛保护',
    commStatus: 1,
    ipAddress: '192.168.3.101',
    telemetries: [
      { pointId: 1, name: '光伏交流输出有功功率', factor: 1.0, unit: 'kW', rawValue: 1420.8, value: 1420.8 },
      { pointId: 2, name: '光伏直流母线电压', factor: 1.0, unit: 'V', rawValue: 680.5, value: 680.5 },
      { pointId: 3, name: '光伏直流母线电流', factor: 1.0, unit: 'A', rawValue: 2100.0, value: 2100.0 },
      { pointId: 4, name: '当日累计光伏发电量', factor: 1.0, unit: 'kWh', rawValue: 12450, value: 12450 },
      { pointId: 5, name: '逆变器机芯转换效率', factor: 0.1, unit: '%', rawValue: 986, value: 98.6 },
      { pointId: 6, name: '厂区太阳能光照辐射强度', factor: 1.0, unit: 'W/㎡', rawValue: 845, value: 845 }
    ],
    teleSignals: [
      { pointId: 1, name: '逆变器并网状态 (0:待机/1:并网/2:故障)', value: 1, statusText: '并网发电 (1)' },
      { pointId: 2, name: '防孤岛保护装置状态 (0:未投/1:投运/2:动作)', value: 1, statusText: '投运监视 (1)' },
      { pointId: 3, name: '光伏直流侧绝缘阻抗告警 (0:常/1:告警/2:障)', value: 0, statusText: '正常 (0)' }
    ],
    energies: [
      { pointId: 1, name: '光伏总累计上网电量', factor: 0.01, unit: 'kWh', value: 845200.0 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '光伏逆变器远方启停',
        options: [
          { label: '远程停机 (0)', value: 0 },
          { label: '远程启机 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: [
      { pointId: 1, name: '光伏最大有功功率限制出力', unit: 'kW', min: 0, max: 2000, step: 50, value: 1500 }
    ]
  },
  {
    deviceId: 'DEV-PV-3501',
    deviceName: '35kV 光伏集电进线 301 测控保护装置',
    deviceType: '35kV 线路测控保护微机单元',
    commStatus: 1,
    ipAddress: '192.168.4.101',
    telemetries: [
      { pointId: 1, name: '35kV母线AB线电压', factor: 0.1, unit: 'kV', rawValue: 352.5, value: 35.25, description: '35kV I段母线Uab' },
      { pointId: 2, name: '35kV母线BC线电压', factor: 0.1, unit: 'kV', rawValue: 352.8, value: 35.28, description: '35kV I段母线Ubc' },
      { pointId: 3, name: '35kV母线CA线电压', factor: 0.1, unit: 'kV', rawValue: 352.3, value: 35.23, description: '35kV I段母线Uca' },
      { pointId: 4, name: '301集电进线A相电流', factor: 1.0, unit: 'A', rawValue: 135.2, value: 135.2, description: '301集电回路Ia' },
      { pointId: 5, name: '301集电进线B相电流', factor: 1.0, unit: 'A', rawValue: 134.8, value: 134.8, description: '301集电回路Ib' },
      { pointId: 6, name: '301集电进线C相电流', factor: 1.0, unit: 'A', rawValue: 135.6, value: 135.6, description: '301集电回路Ic' },
      { pointId: 7, name: '301集电线路有功功率', factor: 1.0, unit: 'kW', rawValue: 8240.5, value: 8240.5, description: '301集电回路总有功功率' },
      { pointId: 8, name: '301集电线路无功功率', factor: 1.0, unit: 'kvar', rawValue: 620.4, value: 620.4, description: '301集电回路总无功功率' },
      { pointId: 9, name: '301回路综合功率因数', factor: 0.01, unit: '', rawValue: 99, value: 0.99, description: '301集电综合功率因数' },
      { pointId: 10, name: '电网基准系统频率', factor: 0.01, unit: 'Hz', rawValue: 5001, value: 50.01, description: '电网工频基准' }
    ],
    teleSignals: [
      { pointId: 1, name: '301 真空断路器位置 (0:分/1:合/2:跳)', value: 1, statusText: '合闸 (1)' },
      { pointId: 2, name: '301 母线侧隔离手车 (0:试/1:工/2:检)', value: 1, statusText: '工作位置 (1)' },
      { pointId: 3, name: '301 出线侧隔离刀闸 (0:分/1:合/2:障)', value: 1, statusText: '合闸 (1)' },
      { pointId: 4, name: '301 线路侧快速接地刀 (0:分/1:合/2:障)', value: 0, statusText: '分闸 (0)' },
      { pointId: 5, name: '301 弹簧储能状态 (0:已储/1:未储)', value: 0, statusText: '已储能 (0)' },
      { pointId: 6, name: '301 微机保护动作总告警 (0:常/1:动)', value: 0, statusText: '正常 (0)' }
    ],
    energies: [
      { pointId: 1, name: '301回路反向有功上网电量', factor: 0.01, unit: 'MWh', value: 3450.8 }
    ],
    teleControls: [
      {
        pointId: 1,
        name: '301 断路器分合闸遥控',
        targetPointId: 1,
        options: [
          { label: '分闸指令 (0)', value: 0 },
          { label: '合闸指令 (1)', value: 1 }
        ]
      }
    ],
    teleRegulations: []
  },
  {
    deviceId: 'DEV-PV-BOX01',
    deviceName: '1# 光伏升压箱变 3150kVA 测控装置',
    deviceType: '箱式变电站综合测控终端',
    commStatus: 1,
    ipAddress: '192.168.4.102',
    telemetries: [
      { pointId: 1, name: '箱变高压侧线电压', factor: 0.1, unit: 'kV', rawValue: 352.4, value: 35.24 },
      { pointId: 2, name: '箱变低压侧Uab电压', factor: 1.0, unit: 'V', rawValue: 805.2, value: 805.2 },
      { pointId: 3, name: '箱变低压侧总输入电流', factor: 1.0, unit: 'A', rawValue: 2250.0, value: 2250.0 },
      { pointId: 4, name: '箱变双分裂输出总功率', factor: 1.0, unit: 'kW', rawValue: 3125.0, value: 3125.0 },
      { pointId: 5, name: '箱变顶层油温传感器', factor: 1.0, unit: '℃', rawValue: 54.6, value: 54.6 },
      { pointId: 6, name: '箱变三相绕组热点温度', factor: 1.0, unit: '℃', rawValue: 62.3, value: 62.3 },
      { pointId: 7, name: '箱变当前视在负荷率', factor: 1.0, unit: '%', rawValue: 78.5, value: 78.5 },
      { pointId: 8, name: '光伏子阵太阳辐射度', factor: 1.0, unit: 'W/㎡', rawValue: 885, value: 885 },
      { pointId: 9, name: '光伏组件背板电池温度', factor: 1.0, unit: '℃', rawValue: 42.5, value: 42.5 },
      { pointId: 10, name: '组串逆变器综合效率', factor: 0.1, unit: '%', rawValue: 988, value: 98.8 }
    ],
    teleSignals: [
      { pointId: 1, name: '箱变35kV侧高压真空负荷开关 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
      { pointId: 2, name: '箱变0.8kV低压进线断路器1 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
      { pointId: 3, name: '箱变0.8kV低压进线断路器2 (0:分/1:合)', value: 1, statusText: '合闸 (1)' },
      { pointId: 4, name: '箱变重瓦斯跳闸 (0:常/1:动)', value: 0, statusText: '正常 (0)' },
      { pointId: 5, name: '箱变油位异常告警 (0:常/1:告警)', value: 0, statusText: '正常 (0)' },
      { pointId: 6, name: '箱变压力释放阀动作 (0:常/1:动)', value: 0, statusText: '正常 (0)' },
      { pointId: 7, name: '箱变舱内强制风冷启动 (0:停/1:运)', value: 1, statusText: '运行 (1)' }
    ],
    energies: [
      { pointId: 1, name: '箱变累计上网电量', factor: 0.01, unit: 'MWh', value: 1890.6 }
    ],
    teleControls: [],
    teleRegulations: []
  }
];

const syncStation = syncFlatDataFromDevices(STATION_DEVICES);

export const INITIAL_DATASETS: DatasetItem[] = [
  {
    id: 'ds-scada-station',
    name: '110kV/10kV 智能变电站 SCADA 集控数据集 (装置级)',
    description: '以装置号为初始单位，涵盖 DEV-101 (10kV进线)、DEV-102 (1#主变)、DEV-103 (母联备自投)、DEV-201 (低压配电)、DEV-301 (分布式光伏) 的遥测、遥信(0/1/2)、电度、遥控与遥调',
    type: 'mock',
    updateIntervalMs: 2000,
    isStreaming: true,
    devices: JSON.parse(JSON.stringify(STATION_DEVICES)),
    data: syncStation.data,
    fields: syncStation.fields
  }
];

// Helper function to tick dynamic dataset values realistically
export function tickDataset(dataset: DatasetItem): DatasetItem {
  if (!dataset) return dataset;
  if (dataset.type !== 'mock' || !dataset.isStreaming) return dataset;

  const devices = dataset.devices || [];
  const targetData = dataset.data || {};

  for (let d = 0; d < devices.length; d++) {
    const dev = devices[d];
    const devId = dev.deviceId;

    // 1. Tick Telemetries (遥测轻微自然波动)
    if (dev.telemetries) {
      for (let t = 0; t < dev.telemetries.length; t++) {
        const yc = dev.telemetries[t];
        if (yc.unit === 'kV') {
          const delta = (Math.random() - 0.5) * (yc.value > 20 ? 0.08 : 0.04);
          yc.value = Number((yc.value + delta).toFixed(2));
        } else if (yc.unit === 'A') {
          const delta = (Math.random() - 0.5) * (yc.value * 0.02);
          yc.value = Math.max(0, Number((yc.value + delta).toFixed(1)));
        } else if (yc.unit === 'kW' || yc.unit === 'kvar') {
          const delta = (Math.random() - 0.5) * (yc.value * 0.02);
          yc.value = Math.max(0, Number((yc.value + delta).toFixed(1)));
        } else if (yc.unit === 'Hz') {
          const delta = (Math.random() - 0.5) * 0.02;
          yc.value = Math.max(49.95, Math.min(50.05, Number((yc.value + delta).toFixed(2))));
        } else if (yc.unit === '℃') {
          const delta = (Math.random() - 0.5) * 0.2;
          yc.value = Math.max(20, Math.min(90, Number((yc.value + delta).toFixed(1))));
        }
        targetData[`${devId}_YC_${yc.pointId}`] = yc.value;
      }
    }

    // 2. Increment energy slightly
    if (dev.energies) {
      for (let e = 0; e < dev.energies.length; e++) {
        const dd = dev.energies[e];
        dd.value = Number((dd.value + Math.random() * 0.2).toFixed(1));
        targetData[`${devId}_DD_${dd.pointId}`] = dd.value;
      }
    }
  }

  targetData.timestamp = new Date().toLocaleTimeString();

  return {
    ...dataset,
    devices,
    data: { ...targetData }
  };
}

// Global Simulated Closed-Loop Tele-control Dispatcher (SCADA 闭环遥控执行)
export function executeSimulatedTeleControl(
  dataset: DatasetItem,
  deviceId: string,
  controlPointId: number | string,
  targetValue: number
): { success: boolean; message: string; verified: boolean; feedbackStatusText?: string; updatedDataset: DatasetItem } {
  const device = dataset.devices.find(d => d.deviceId === deviceId);
  if (!device) {
    return { success: false, message: `未找到装置: ${deviceId}`, verified: false, updatedDataset: dataset };
  }

  const control = device.teleControls.find(c => String(c.pointId) === String(controlPointId));
  if (!control) {
    return { success: false, message: `未找到遥控点号: ${controlPointId}`, verified: false, updatedDataset: dataset };
  }

  control.lastExecutedValue = targetValue;
  control.lastExecutedTime = new Date().toLocaleTimeString();

  // Find option label
  const matchedOpt = control.options?.find(o => o.value === targetValue);
  const actionLabel = matchedOpt?.label || `状态 (${targetValue})`;

  // 1. 遥控关联遥信变位与闭环校验 (Closed-loop Tele-control Verification)
  let verified = false;
  let feedbackStatusText = '';

  const targetYxPointId = control.targetPointId !== undefined ? control.targetPointId : 1;
  const yx = device.teleSignals?.find(s => String(s.pointId) === String(targetYxPointId));

  if (yx) {
    // 模拟工业测控装置接收并执行下发指令，遥信点变位
    yx.value = targetValue;
    if (yx.enumMapping && yx.enumMapping[targetValue]) {
      yx.statusText = `${yx.enumMapping[targetValue]} (${targetValue})`;
    } else if (targetValue === 0) {
      yx.statusText = '分闸 (0)';
    } else if (targetValue === 1) {
      yx.statusText = '合闸 (1)';
    } else if (targetValue === 2) {
      yx.statusText = '故障 (2)';
    } else if (targetValue === 3) {
      yx.statusText = '试验位 (3)';
    } else if (targetValue === 4) {
      yx.statusText = '工作位 (4)';
    } else {
      yx.statusText = `状态 (${targetValue})`;
    }

    // 2. 检测遥信点变位结果是否与遥控指令一致 (Verification)
    if (yx.value === targetValue) {
      verified = true;
      control.lastVerifiedResult = 'verified_success';
      feedbackStatusText = yx.statusText;
    } else {
      verified = false;
      control.lastVerifiedResult = 'verified_failed';
    }
  } else {
    // 若未配置关联遥信，仍视作下发完成
    verified = true;
    control.lastVerifiedResult = 'verified_success';
  }

  const synced = syncFlatDataFromDevices(dataset.devices);

  const verificationMsg = verified
    ? `✓ [遥控闭环校验成功] 装置 ${device.deviceName} (${deviceId}) 遥控点 [${control.name}] 指令已生效，对应遥信 [YX_${targetYxPointId}] 状态已变位为: ${feedbackStatusText || actionLabel}`
    : `✕ [遥控闭环校验失败] 遥信点 [YX_${targetYxPointId}] 反馈状态与下发指令 [${actionLabel}] 不符`;

  return {
    success: true,
    verified,
    feedbackStatusText,
    message: verificationMsg,
    updatedDataset: {
      ...dataset,
      data: synced.data,
      fields: synced.fields
    }
  };
}

// Global Simulated Closed-Loop Tele-regulation Dispatcher (SCADA 闭环遥调执行)
export function executeSimulatedTeleRegulation(
  dataset: DatasetItem,
  deviceId: string,
  regulationPointId: number | string,
  targetValue: number
): { success: boolean; message: string; verified: boolean; updatedDataset: DatasetItem } {
  const device = dataset.devices.find(d => d.deviceId === deviceId);
  if (!device) {
    return { success: false, message: `未找到装置: ${deviceId}`, verified: false, updatedDataset: dataset };
  }

  const yt = device.teleRegulations.find(r => String(r.pointId) === String(regulationPointId));
  if (!yt) {
    return { success: false, message: `未找到遥调点号: ${regulationPointId}`, verified: false, updatedDataset: dataset };
  }

  yt.value = targetValue;
  yt.lastExecutedTime = new Date().toLocaleTimeString();

  // 若关联了遥测联动 (例如变压器档位影响高压侧电压/电流，或定值整定)
  if (yt.targetYcPointId !== undefined) {
    const yc = device.telemetries?.find(p => String(p.pointId) === String(yt.targetYcPointId));
    if (yc) {
      // 联动模拟修正遥测测值
      yc.value = Number((yc.value * (1 + (targetValue % 5 - 2) * 0.01)).toFixed(2));
    }
  }

  yt.lastVerifiedResult = 'verified_success';
  const synced = syncFlatDataFromDevices(dataset.devices);

  return {
    success: true,
    verified: true,
    message: `✓ [遥调定值下发校验成功] 装置 ${device.deviceName} (${deviceId}) 遥调点 [${yt.name}] 定值整定为: ${targetValue} ${yt.unit}，现场定值区校验通过`,
    updatedDataset: {
      ...dataset,
      data: synced.data,
      fields: synced.fields
    }
  };
}

export const PRESET_SCADA_DEVICES = STATION_DEVICES;

