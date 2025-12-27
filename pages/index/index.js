// index.js - 支持多时段打卡的新版本
Page({
  data: {
    lastAction: '欢迎使用劳动时间记录', // 上次操作类型
    currentTime: '', // 当前时间
    currentDate: '', // 当前日期
    workDuration: '0秒', // 总工作时长（始终显示）
    mainWorkDuration: '0秒', // 主工作时长
    overtimeDuration: '0秒', // 加班时长
    workStatus: 'idle', // 工作状态: idle, main_working, break, overtime, completed
    statusText: '未开始工作', // 状态文本显示
    todayRecord: null, // 今日完整记录
    showOvertimeOption: false // 是否显示加班选项
  },

  // 获取当前时间（精确到秒）
  getCurrentTime() {
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const seconds = now.getSeconds()
    return (hours < 10 ? '0' + hours : hours) + ':' + 
           (minutes < 10 ? '0' + minutes : minutes) + ':' + 
           (seconds < 10 ? '0' + seconds : seconds)
  },

  // 获取当前日期
  getCurrentDate() {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[now.getDay()]
    
    return year + '年' + (month < 10 ? '0' + month : month) + '月' + 
           (day < 10 ? '0' + day : day) + '日 ' + weekDay
  },

  // 统一的日期格式化方法 - 返回 YYYY/MM/DD 格式
  formatDate(date) {
    const d = date || new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return year + '/' + (month < 10 ? '0' + month : month) + '/' + (day < 10 ? '0' + day : day)
  },

  // 获取今日记录
  getTodayRecord() {
    const today = this.formatDate()
    const records = wx.getStorageSync('clockRecords') || []
    return records.find(record => record.date === today) || null
  },

  // 判断工作状态
  determineWorkStatus(todayRecord) {
    if (!todayRecord || !todayRecord.periods || !Array.isArray(todayRecord.periods)) {
      return 'idle'
    }

    const periods = todayRecord.periods
    const lastPeriod = periods[periods.length - 1]
    
    if (!lastPeriod) {
      return 'idle'
    }

    // 如果最后一个时段有开始时间但没有结束时间
    if (lastPeriod.clockIn && !lastPeriod.clockOut) {
      return lastPeriod.type === 'main' ? 'main_working' : 'overtime'
    }
    
    // 如果最后一个时段已结束
    if (lastPeriod.clockOut) {
      // 只要是已结束的时段，都显示为休息中
      return 'break' // 休息中
    }
    
    return 'idle'
  },

  // 计算时段时长
  calculatePeriodDuration(clockIn, clockOut) {
    if (!clockIn) return null
    
    let endTime
    
    if (clockOut) {
      // 如果有结束时间，使用结束时间
      endTime = new Date(`2024/01/01 ${clockOut}`)
    } else {
      // 如果没有结束时间（进行中的时段），使用当前时间
      const currentTime = this.getCurrentTime()
      endTime = new Date(`2024/01/01 ${currentTime}`)
    }
    
    const startTime = new Date(`2024/01/01 ${clockIn}`)
    
    let diffMs = endTime - startTime
    if (clockOut && diffMs < 0) {
      // 跨天情况
      diffMs += 24 * 60 * 60 * 1000
    }
    
    const diffSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(diffSeconds / 3600)
    const minutes = Math.floor((diffSeconds % 3600) / 60)
    const seconds = diffSeconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  },

  // 格式化时长显示
  formatDuration(duration) {
    if (!duration) return '0秒'
    
    const [hours, minutes, seconds] = duration.split(':').map(Number)
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟${seconds}秒`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`
    } else {
      return `${seconds}秒`
    }
  },

  // 计算今日总工作时长
  calculateTodayTotalDuration() {
    const todayRecord = this.getTodayRecord()
    
    if (!todayRecord || !todayRecord.periods || !Array.isArray(todayRecord.periods)) {
      return { total: '0秒', main: '0秒', overtime: '0秒' }
    }

    let totalSeconds = 0
    let mainSeconds = 0
    let overtimeSeconds = 0

    todayRecord.periods.forEach(period => {
      const duration = this.calculatePeriodDuration(period.clockIn, period.clockOut)
      if (duration) {
        const [h, m, s] = duration.split(':').map(Number)
        const seconds = h * 3600 + m * 60 + s
        totalSeconds += seconds
        
        if (period.type === 'main') {
          mainSeconds += seconds
        } else if (period.type === 'overtime') {
          overtimeSeconds += seconds
        }
      }
    })

    return {
      total: this.formatDuration(this.secondsToDuration(totalSeconds)),
      main: this.formatDuration(this.secondsToDuration(mainSeconds)),
      overtime: this.formatDuration(this.secondsToDuration(overtimeSeconds))
    }
  },

  // 秒数转换为时长格式
  secondsToDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  // 主工作打卡（上班/下班）
  mainWorkClock() {
    const currentTime = this.getCurrentTime()
    const today = this.formatDate()
    
    try {
      const records = wx.getStorageSync('clockRecords') || []
      
      // 查找今日记录
      let todayRecord = records.find(record => record.date === today)
      
      if (!todayRecord) {
        // 创建新的今日记录
        todayRecord = {
          date: today,
          periods: [],
          totalWorkTime: null
        }
        records.push(todayRecord)
      }

      // 确保 periods 属性存在
      if (!todayRecord.periods) {
        todayRecord.periods = []
      }

      // 查找未结束的主工作时段
      const unfinishedMainPeriod = todayRecord.periods.find(p => p.type === 'main' && !p.clockOut)
      
      if (unfinishedMainPeriod) {
        // 结束主工作时段（下班打卡）
        unfinishedMainPeriod.clockOut = currentTime
        unfinishedMainPeriod.duration = this.calculatePeriodDuration(unfinishedMainPeriod.clockIn, currentTime)

        // 重新计算总时长
        let totalSeconds = 0
        todayRecord.periods.forEach(period => {
          if (period.duration) {
            const [h, m, s] = period.duration.split(':').map(Number)
            totalSeconds += h * 3600 + m * 60 + s
          }
        })
        todayRecord.totalWorkTime = this.secondsToDuration(totalSeconds)

        // 保存记录
        wx.setStorageSync('clockRecords', records)
        
        this.setData({
          lastAction: '下班打卡成功，主时段工作已结束',
          todayRecord: todayRecord
        })

        // 重新检查工作状态
        this.checkWorkStatus()

        wx.showToast({
          title: '下班打卡成功',
          icon: 'success'
        })

      } else {
        // 开始新的主工作时段（上班打卡）
        todayRecord.periods.push({
          type: 'main',
          clockIn: currentTime,
          clockOut: null,
          duration: null
        })

        // 保存记录
        wx.setStorageSync('clockRecords', records)
        
        this.setData({
          workStatus: 'main_working',
          statusText: this.getStatusText('main_working'),
          lastAction: '上班打卡成功，开始记录工作时长',
          todayRecord: todayRecord
        })

        wx.showToast({
          title: '上班打卡成功',
          icon: 'success'
        })
      }

      wx.vibrateShort()
      this.updateDurationDisplay()
      
    } catch (error) {
      console.error('主工作打卡失败:', error)
      wx.showToast({
        title: '打卡失败',
        icon: 'error'
      })
    }
  },

  // 加班打卡（开始/结束）
  overtimeClock() {
    const currentTime = this.getCurrentTime()
    const today = this.formatDate()
    
    try {
      const records = wx.getStorageSync('clockRecords') || []
      
      // 查找今日记录
      let todayRecord = records.find(record => record.date === today)
      
      if (!todayRecord) {
        // 创建新的今日记录
        todayRecord = {
          date: today,
          periods: [],
          totalWorkTime: null
        }
        records.push(todayRecord)
      }

      // 确保 periods 属性存在
      if (!todayRecord.periods) {
        todayRecord.periods = []
      }

      // 查找未结束的加班时段
      const unfinishedOvertimePeriod = todayRecord.periods.find(p => p.type === 'overtime' && !p.clockOut)
      
      if (unfinishedOvertimePeriod) {
        // 结束加班时段
        unfinishedOvertimePeriod.clockOut = currentTime
        unfinishedOvertimePeriod.duration = this.calculatePeriodDuration(unfinishedOvertimePeriod.clockIn, currentTime)

        // 重新计算总时长
        let totalSeconds = 0
        todayRecord.periods.forEach(period => {
          if (period.duration) {
            const [h, m, s] = period.duration.split(':').map(Number)
            totalSeconds += h * 3600 + m * 60 + s
          }
        })
        todayRecord.totalWorkTime = this.secondsToDuration(totalSeconds)

        // 保存记录
        wx.setStorageSync('clockRecords', records)
        
        this.setData({
          lastAction: '加班结束打卡成功，加班时段已结束',
          todayRecord: todayRecord
        })

        // 重新检查工作状态
        this.checkWorkStatus()

        wx.showToast({
          title: '加班结束成功',
          icon: 'success'
        })

      } else {
        // 开始新的加班时段
        todayRecord.periods.push({
          type: 'overtime',
          clockIn: currentTime,
          clockOut: null,
          duration: null
        })

        // 保存记录
        wx.setStorageSync('clockRecords', records)
        
        this.setData({
          workStatus: 'overtime',
          statusText: this.getStatusText('overtime'),
          lastAction: '加班打卡成功，开始记录加班时长',
          todayRecord: todayRecord
        })

        wx.showToast({
          title: '加班打卡成功',
          icon: 'success'
        })
      }

      wx.vibrateShort()
      this.updateDurationDisplay()
      
    } catch (error) {
      console.error('加班打卡失败:', error)
      wx.showToast({
        title: '打卡失败',
        icon: 'error'
      })
    }
  },

  // 获取状态文本
  getStatusText(workStatus) {
    switch (workStatus) {
      case 'idle':
        return '未开始工作'
      case 'main_working':
        return '工作中'
      case 'break':
        return '休息中'
      case 'overtime':
        return '加班中'
      default:
        return '未知状态'
    }
  },

  onLoad() {
    this.repairStorageData()
    
    // 确保初始状态正确显示
    this.setData({
      statusText: this.getStatusText('idle')
    })
    
    // 添加格式化时长的WXML辅助函数
    this.setData({
      formatDuration: this.formatDuration.bind(this)
    })
    
    this.updateTime()
    this.checkWorkStatus()
    
    // 每秒更新时间
    this.timeInterval = setInterval(() => {
      this.updateTime()
    }, 1000)
  },

  // 修复存储数据
  repairStorageData() {
    try {
      const records = wx.getStorageSync('clockRecords')
      if (!records || !Array.isArray(records)) {
        // 如果数据不存在或不是数组，初始化为空数组
        wx.setStorageSync('clockRecords', [])
        return
      }

      // 修复每个记录的 periods 属性
      const repairedRecords = records.map(record => {
        if (!record || typeof record !== 'object') {
          return null
        }

        if (!record.periods || !Array.isArray(record.periods)) {
          record.periods = []
        }

        return record
      }).filter(record => record !== null)

      wx.setStorageSync('clockRecords', repairedRecords)
      
    } catch (error) {
      console.error('修复存储数据失败:', error)
      wx.setStorageSync('clockRecords', [])
    }
  },

  // 更新时间显示
  updateTime() {
    this.setData({
      currentTime: this.getCurrentTime(),
      currentDate: this.getCurrentDate()
    })
    
    // 同时更新工作时长（实时计算进行中的时段）
    this.updateDurationDisplay()
  },

  // 检查工作状态
  checkWorkStatus() {
    const todayRecord = this.getTodayRecord()
    const workStatus = this.determineWorkStatus(todayRecord)
    const statusText = this.getStatusText(workStatus)
    
    // 根据状态设置对应的操作提示
    let actionPrompt = ''
    switch (workStatus) {
      case 'idle':
        actionPrompt = '点击上班打卡开始记录工作时长'
        break
      case 'main_working':
        actionPrompt = '正在记录工作时段，点击下班打卡结束'
        break
      case 'break':
        actionPrompt = '正在休息中，如需继续请点击打卡'
        break
      case 'overtime':
        actionPrompt = '正在记录加班时段，点击结束加班打卡'
        break
      default:
        actionPrompt = '欢迎使用劳动时间记录'
    }
    
    this.setData({
      todayRecord: todayRecord,
      workStatus: workStatus,
      statusText: statusText,
      lastAction: actionPrompt
    })

    // 更新时长显示
    this.updateDurationDisplay()
  },

  // 更新时长显示
  updateDurationDisplay() {
    const durations = this.calculateTodayTotalDuration()
    this.setData({
      workDuration: durations.total,
      mainWorkDuration: durations.main,
      overtimeDuration: durations.overtime
    })
  },

  onShow() {
    this.checkWorkStatus()
  },

  onUnload() {
    // 清理定时器
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
  }
})