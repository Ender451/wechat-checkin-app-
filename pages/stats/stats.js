// stats.js - 支持多时段统计分析
Page({
  data: {
    records: [],
    stats: {
      totalDays: 0,
      avgWorkTime: '0小时0分钟',
      avgOvertimeTime: '0小时0分钟',
      totalOvertimeTime: '0小时0分钟',
      totalOvertimeDays: 0,
      earliestClockIn: '--',
      latestClockOut: '--'
    },
    chartData: null,
    selectedMonth: '',
    selectedRange: 'month',
    isRecent30Days: false,
    isAllTime: false,
    chartTitle: '时间筛选上下班时间趋势',
    displayMonthText: '时间筛选：'
  },

  // 统一的日期格式化方法 - 返回 YYYY/MM/DD 格式
  formatDate(date) {
    const d = date || new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return year + '/' + (month < 10 ? '0' + month : month) + '/' + (day < 10 ? '0' + day : day)
  },

  // 格式化时间显示 - 只显示小时和分钟，兼容 HH:MM 和 HH:MM:SS 格式
  formatTimeForDisplay(time) {
    if (!time || typeof time !== 'string') {
      return time
    }
    
    const timeParts = time.split(':')
    if (timeParts.length >= 2) {
      // 只取小时和分钟部分
      const hours = timeParts[0]
      const minutes = timeParts[1]
      return `${hours}:${minutes}`
    }
    
    return time // 如果格式异常，返回原值
  },

  // 将时间字符串转换为分钟数（用于比较时间早晚）
  timeToMinutes(time) {
    if (!time || typeof time !== 'string') {
      return 0
    }
    
    const timeParts = time.split(':')
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0]) || 0
      const minutes = parseInt(timeParts[1]) || 0
      return hours * 60 + minutes
    }
    
    return 0
  },

  // 将分钟数转换为时间字符串
  minutesToTime(minutes) {
    if (!minutes || minutes === 0) {
      return '00:00:00'
    }
    
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`
  },

  // 将秒数转换为时长字符串
  secondsToDuration(seconds) {
    if (!seconds || seconds === 0) {
      return '00:00:00'
    }
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  },

  onLoad() {
    this.initializeSelectedMonth()
    this.migrateData() // 迁移历史数据，统一日期格式
    this.loadRecords()
  },

  // 初始化选中的月份
  initializeSelectedMonth() {
    // 默认显示当前月份
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    
    this.setData({
      selectedMonth: currentMonthStr,
      selectedRange: 'month',
      isRecent30Days: false,
      isAllTime: false,
      chartTitle: currentMonthStr + '月上下班时间趋势',
      displayMonthText: '时间筛选：' + currentMonthStr
    })
  },

  // 迁移历史数据，统一日期格式
  migrateData() {
    try {
      const records = wx.getStorageSync('clockRecords') || []
      let hasChanges = false
      
      const migratedRecords = records.map(record => {
        let updatedRecord = record
        let recordChanged = false
        
        // 处理旧数据格式迁移
        if (record.type && (record.type === '上班' || record.type === '下班')) {
          // 旧格式数据，跳过已在app.js中处理
          return record
        }
        
        return updatedRecord
      })
      
      if (hasChanges) {
        wx.setStorageSync('clockRecords', migratedRecords)
        console.log('统计数据页面：历史数据迁移完成')
      }
    } catch (error) {
      console.error('统计数据页面：数据迁移失败:', error)
    }
  },

  // 重置到时间筛选（月份选择）
  resetToMonthFilter() {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const currentMonthStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`
    
    this.setData({
      selectedMonth: currentMonthStr,
      selectedRange: 'month',
      isRecent30Days: false,
      isAllTime: false,
      chartTitle: currentMonthStr + '月上下班时间趋势',
      displayMonthText: '时间筛选：' + currentMonthStr
    })
    this.loadRecords()
  },

  // 重置到全部时间
  resetToAllTime() {
    this.setData({
      selectedMonth: '',
      selectedRange: 'all',
      isRecent30Days: false,
      isAllTime: true,
      chartTitle: '全部时间上下班时间趋势',
      displayMonthText: '全部时间'
    })
    this.loadRecords()
  },

  // 月份选择变化
  onMonthChange(e) {
    const selectedValue = e.detail.value
    this.setData({
      selectedMonth: selectedValue,
      selectedRange: selectedValue,
      isRecent30Days: false,
      isAllTime: false,
      chartTitle: selectedValue + '月上下班时间趋势',
      displayMonthText: '时间筛选：' + selectedValue
    })
    this.loadRecords()
  },

  // 重置到最近30天
  resetToRecentDays() {
    this.setData({
      selectedMonth: '',
      selectedRange: 'recent30',
      isRecent30Days: true,
      isAllTime: false,
      chartTitle: '近30天上下班时间趋势',
      displayMonthText: '最近30天'
    })
    this.loadRecords()
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const records = wx.getStorageSync('clockRecords') || []
    
    // 生成日期范围
    const dateRange = this.generateDateRange()
    
    // 为每个日期获取对应的多时段记录
    const processedRecords = dateRange.map(date => {
      const dayRecord = records.find(record => record.date === date)
      
      if (dayRecord && dayRecord.periods) {
        // 新格式多时段数据
        const mainPeriods = dayRecord.periods.filter(p => p.type === 'main')
        const overtimePeriods = dayRecord.periods.filter(p => p.type === 'overtime')
        
        // 找到主工作时段中最早上班时间和最晚下班时间
        let earliestClockIn = null
        let latestClockOut = null
        let totalMainDuration = 0
        
        // 找主时段最早上班时间
        const validMainClockInTimes = mainPeriods
          .filter(p => p.clockIn)
          .map(p => this.timeToMinutes(p.clockIn))
        if (validMainClockInTimes.length > 0) {
          const minMinutes = Math.min(...validMainClockInTimes)
          earliestClockIn = this.minutesToTime(minMinutes)
        }
        
        // 找主时段最晚下班时间
        const validMainClockOutTimes = mainPeriods
          .filter(p => p.clockOut)
          .map(p => this.timeToMinutes(p.clockOut))
        if (validMainClockOutTimes.length > 0) {
          const maxMinutes = Math.max(...validMainClockOutTimes)
          latestClockOut = this.minutesToTime(maxMinutes)
        }
        
        // 计算总主工作时长
        mainPeriods.forEach(period => {
          if (period.duration) {
            const [h, m, s] = period.duration.split(':').map(Number)
              totalMainDuration += h * 3600 + m * 60 + s
          }
        })
        
        return {
          date: date,
          dateStr: this.formatDateStr(date),
          weekDay: this.getWeekDay(date),
          clockIn: earliestClockIn ? this.formatTimeForDisplay(earliestClockIn) : '',
          clockOut: latestClockOut ? this.formatTimeForDisplay(latestClockOut) : '',
          duration: totalMainDuration > 0 ? this.secondsToDuration(totalMainDuration) : null,
          totalDuration: dayRecord.totalWorkTime || null,
          overtimeDuration: this.calculateTotalOvertimeDuration(overtimePeriods),
          hasOvertime: overtimePeriods.length > 0
        }
      } else {
        // 空记录
        return {
          date: date,
          dateStr: this.formatDateStr(date),
          weekDay: this.getWeekDay(date),
          clockIn: '',
          clockOut: '',
          duration: null,
          totalDuration: null,
          overtimeDuration: null,
          hasOvertime: false
        }
      }
    })
    
    this.setData({ records: processedRecords })
    this.calculateStats(processedRecords)
    
    // 只有在选择了有效的时间范围时才处理图表数据
    if (this.data.selectedRange !== 'month' || this.data.selectedMonth) {
      this.processChartData(processedRecords)
      
      // 如果是全部时间且数据点过多，更新图表标题
      if (this.data.isAllTime && processedRecords.length > 90) {
        this.setData({
          chartTitle: '全部时间上下班时间趋势 (采样显示)'
        })
      }
      
      // 延迟绘制图表，确保DOM渲染完成
      setTimeout(() => {
        this.drawChart()
      }, 500)
    } else {
      // 清空图表数据
      this.setData({
        chartData: null
      })
    }
  },

  // 计算总加班时长
  calculateTotalOvertimeDuration(overtimePeriods) {
    if (!overtimePeriods || overtimePeriods.length === 0) {
      return null
    }
    
    let totalSeconds = 0
    overtimePeriods.forEach(period => {
      if (period.duration) {
        const [h, m, s] = period.duration.split(':').map(Number)
        totalSeconds += h * 3600 + m * 60 + s
      }
    })
    
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  },

  // 格式化日期字符串
  formatDateStr(dateStr) {
    const dateObj = new Date(dateStr)
    const month = dateObj.getMonth() + 1
    const day = dateObj.getDate()
    return (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day)
  },

  // 获取星期几
  getWeekDay(dateStr) {
    const dateObj = new Date(dateStr)
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekDays[dateObj.getDay()]
  },

  // 生成日期范围（支持所有时间、最近30天和按月份筛选）
  generateDateRange() {
    const records = wx.getStorageSync('clockRecords') || []
    
    if (this.data.isAllTime) {
      // 全部时间：从记录中获取实际的日期范围
      if (records.length === 0) {
        return []
      }
      
      // 获取最早和最晚的日期
      const dates = records.map(record => record.date).filter(date => date)
      if (dates.length === 0) {
        return []
      }
      
      const earliestDate = new Date(Math.min(...dates.map(d => new Date(d))))
      const latestDate = new Date(Math.max(...dates.map(d => new Date(d))))
      
      const dateRange = []
      const current = new Date(earliestDate)
      while (current <= latestDate) {
        dateRange.push(this.formatDate(current))
        current.setDate(current.getDate() + 1)
      }
      return dateRange
    }
    
    // 处理月份未选择的情况
    if (!this.data.isRecent30Days && !this.data.isAllTime && (!this.data.selectedMonth || this.data.selectedMonth === '')) {
      return [] // 返回空数组，表示没有有效的时间范围
    }
    
    const today = new Date()
    const startDate = new Date(today)
    
    if (this.data.isRecent30Days) {
      startDate.setDate(today.getDate() - 29)
    } else if (this.data.selectedMonth && this.data.selectedMonth !== '') {
      // 如果选择了月份，生成该月的所有日期
      const [year, month] = this.data.selectedMonth.split('-')
      startDate.setFullYear(parseInt(year))
      startDate.setMonth(parseInt(month) - 1)
      startDate.setDate(1)
      
      // 计算该月最后一天
      const lastDay = new Date(year, parseInt(month), 0).getDate()
      const endDate = new Date(year, parseInt(month) - 1, lastDay)
      
      const dateRange = []
      const current = new Date(startDate)
      while (current <= endDate) {
        dateRange.push(this.formatDate(current))
        current.setDate(current.getDate() + 1)
      }
      return dateRange
    }
    
    const dateRange = []
    const current = new Date(startDate)
    while (current <= today) {
      dateRange.push(this.formatDate(current))
      current.setDate(current.getDate() + 1)
    }
    return dateRange
  },

  // 添加页面显示时的重绘
  onReady() {
    if (this.data.chartData) {
      setTimeout(() => {
        this.drawChart()
      }, 100)
    }
  },

  // 计算统计数据
  calculateStats(records) {
    if (records.length === 0) {
      this.setData({
        stats: {
          totalDays: 0,
          avgWorkTime: '0小时0分钟',
          avgOvertimeTime: '0小时0分钟',
          totalOvertimeTime: '0小时0分钟',
          totalOvertimeDays: 0,
          earliestClockIn: '--',
          latestClockOut: '--'
        }
      })
      return
    }

    // 处理多时段数据
    let validDays = []
    let clockInTimes = []
    let clockOutTimes = []
    let workSeconds = 0
    let overtimeSeconds = 0
    let overtimeDays = 0
    let mainWorkDays = [] // 有主工作时段的天数，用于计算平均工作时长

    records.forEach(record => {
      // 只要有任何时段（主时段或加班时段）且有上下班时间就认为是有效天数
      if (record.clockIn && record.clockOut) {
        validDays.push(record.date)
        clockInTimes.push(record.clockIn)
        clockOutTimes.push(record.clockOut)
      }
      
      // 计算主工作时长，只有有主工作时段的天才计入平均工作时长统计
      if (record.duration) {
        const [h, m, s] = record.duration.split(':').map(Number)
        workSeconds += h * 3600 + m * 60 + s
        mainWorkDays.push(record.date) // 记录有主工作时段的天数
      }
      
      // 计算加班时长
      if (record.overtimeDuration) {
        const [oh, om, os] = record.overtimeDuration.split(':').map(Number)
        overtimeSeconds += oh * 3600 + om * 60 + os
      }
      
      // 统计加班天数（只要有加班时段就算加班天）
      if (record.hasOvertime) {
        overtimeDays++
      }
    })

    // 计算平均工作时长（只计算有主工作时段的天数）
    const avgWorkSeconds = mainWorkDays.length > 0 ? Math.round(workSeconds / mainWorkDays.length) : 0
    const avgWorkHours = Math.floor(avgWorkSeconds / 3600)
    const avgWorkMinutes = Math.floor((avgWorkSeconds % 3600) / 60)

    // 计算平均加班时长
    const avgOvertimeSeconds = overtimeDays > 0 ? Math.round(overtimeSeconds / overtimeDays) : 0
    const avgOvertimeHours = Math.floor(avgOvertimeSeconds / 3600)
    const avgOvertimeMinutes = Math.floor((avgOvertimeSeconds % 3600) / 60)

    // 计算总加班时长
    const totalOvertimeHours = Math.floor(overtimeSeconds / 3600)
    const totalOvertimeMinutes = Math.floor((overtimeSeconds % 3600) / 60)

    // 找出最早上班时间和最晚下班时间
    let earliestClockIn = '--'
    let latestClockOut = '--'
    
    if (clockInTimes.length > 0) {
      earliestClockIn = clockInTimes[0]
      for (let k = 1; k < clockInTimes.length; k++) {
        if (clockInTimes[k] < earliestClockIn) {
          earliestClockIn = clockInTimes[k]
        }
      }
    }
    
    if (clockOutTimes.length > 0) {
      latestClockOut = clockOutTimes[0]
      for (let m = 1; m < clockOutTimes.length; m++) {
        if (clockOutTimes[m] > latestClockOut) {
          latestClockOut = clockOutTimes[m]
        }
      }
    }

    // 格式化显示时间，只显示小时和分钟
    const displayEarliestClockIn = earliestClockIn === '--' ? '--' : this.formatTimeForDisplay(earliestClockIn)
    const displayLatestClockOut = latestClockOut === '--' ? '--' : this.formatTimeForDisplay(latestClockOut)

    this.setData({
      stats: {
        totalDays: validDays.length,
        avgWorkTime: avgWorkHours + '小时' + avgWorkMinutes + '分钟',
        avgOvertimeTime: avgOvertimeHours + '小时' + avgOvertimeMinutes + '分钟',
        totalOvertimeTime: totalOvertimeHours + '小时' + totalOvertimeMinutes + '分钟',
        totalOvertimeDays: overtimeDays,
        earliestClockIn: displayEarliestClockIn,
        latestClockOut: displayLatestClockOut
      }
    })
  },

  // 处理图表数据
  processChartData(records) {
    var dates = []
    var clockInData = []
    var clockOutData = []
    var workHoursData = []
    var overtimeHoursData = []

    // 判断统计范围
    if (this.data.isAllTime) {
      // 全部时间：如果数据点太多，进行采样显示
      var maxDisplayPoints = 90 // 最多显示90个数据点（约3个月）
      var effectiveRecords = records
      
      if (records.length > maxDisplayPoints) {
        // 均匀采样
        var step = Math.floor(records.length / maxDisplayPoints)
        effectiveRecords = []
        for (var i = 0; i < records.length; i += step) {
          effectiveRecords.push(records[i])
        }
        // 确保包含最后一个数据点
        if (effectiveRecords[effectiveRecords.length - 1] !== records[records.length - 1]) {
          effectiveRecords.push(records[records.length - 1])
        }
      }
      
      // 处理采样后的数据
      for (var i = 0; i < effectiveRecords.length; i++) {
        var record = effectiveRecords[i]
        var dateObj = new Date(record.date)
        var month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
        var day = dateObj.getDate().toString().padStart(2, '0')
        
        // 对于全部时间，如果年份跨度大，添加年份信息
        if (records.length > 365) { // 超过一年的数据
          var year = dateObj.getFullYear().toString().slice(-2) // 只显示后两位
          dates.push(month + '/' + day + '\n' + year)
        } else {
          dates.push(month + '-' + day)
        }
        
        // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
        var normalizeTime = function(time) {
          if (!time || typeof time !== 'string') return null
          var timeParts = time.split(':')
          if (timeParts.length === 2) {
            return time + ':00'  // HH:MM -> HH:MM:SS
          } else if (timeParts.length === 3) {
            return time          // HH:MM:SS 保持不变
          } else {
            return null          // 格式异常
          }
        }

        if (record.clockIn) {
          var normalizedClockIn = normalizeTime(record.clockIn)
          if (normalizedClockIn) {
            var timeParts = normalizedClockIn.split(':')
            var hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600
            clockInData.push(hours)
          } else {
            clockInData.push(null)
          }
        } else {
          clockInData.push(null)
        }

        if (record.clockOut) {
          var normalizedClockOut = normalizeTime(record.clockOut)
          if (normalizedClockOut) {
            var timeParts2 = normalizedClockOut.split(':')
            var hours2 = parseInt(timeParts2[0]) + parseInt(timeParts2[1]) / 60 + parseInt(timeParts2[2]) / 3600
            clockOutData.push(hours2)
          } else {
            clockOutData.push(null)
          }
        } else {
          clockOutData.push(null)
        }

        // 计算工作时长
        if (record.clockIn && record.clockOut) {
          if (record.duration) {
            var durationParts = record.duration.split(':')
            if (durationParts.length === 3) {
              workHoursData.push(parseInt(durationParts[0]) + parseInt(durationParts[1]) / 60 + parseInt(durationParts[2]) / 3600)
            } else {
              workHoursData.push(null)
            }
          }
        } else {
          workHoursData.push(null)
        }

        // 加班时长数据
        if (record.overtimeDuration) {
          var overtimeParts = record.overtimeDuration.split(':')
          if (overtimeParts.length === 3) {
            overtimeHoursData.push(parseInt(overtimeParts[0]) + parseInt(overtimeParts[1]) / 60 + parseInt(overtimeParts[2]) / 3600)
          } else {
            overtimeHoursData.push(0)
          }
        } else {
          overtimeHoursData.push(0)
        }
      }
    } else if (this.data.isRecent30Days) {
      // 最近30天
      var now = new Date()
      for (var i = 29; i >= 0; i--) {
        var date = new Date(now)
        date.setDate(now.getDate() - i)
        
        // 格式化日期为 MM-DD
        var month = date.getMonth() + 1
        var day = date.getDate()
        var dateStr = (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day)
        dates.push(dateStr)

        // 检查当天是否有记录
        var fullDateStr = this.formatDate(date)
        var dayRecord = records.find(r => r.date === fullDateStr)
        
        // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
        var normalizeTime = function(time) {
          if (!time || typeof time !== 'string') return null
          var timeParts = time.split(':')
          if (timeParts.length === 2) {
            return time + ':00'  // HH:MM -> HH:MM:SS
          } else if (timeParts.length === 3) {
            return time          // HH:MM:SS 保持不变
          } else {
            return null          // 格式异常
          }
        }

        if (dayRecord && dayRecord.clockIn) {
          var normalizedClockIn = normalizeTime(dayRecord.clockIn)
          if (normalizedClockIn) {
            var timeParts = normalizedClockIn.split(':')
            var hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600
            clockInData.push(hours)
          } else {
            clockInData.push(null)
          }
        } else {
          clockInData.push(null)
        }

        if (dayRecord && dayRecord.clockOut) {
          var normalizedClockOut = normalizeTime(dayRecord.clockOut)
          if (normalizedClockOut) {
            var timeParts2 = normalizedClockOut.split(':')
            var hours2 = parseInt(timeParts2[0]) + parseInt(timeParts2[1]) / 60 + parseInt(timeParts2[2]) / 3600
            clockOutData.push(hours2)
          } else {
            clockOutData.push(null)
          }
        } else {
          clockOutData.push(null)
        }

        // 计算工作时长 - 从记录中直接获取或计算
        if (dayRecord && dayRecord.clockIn && dayRecord.clockOut) {
          // 如果记录中已经有duration字段，直接使用
          if (dayRecord.duration) {
            var durationParts = dayRecord.duration.split(':')
            if (durationParts.length === 3) {
              workHoursData.push(parseInt(durationParts[0]) + parseInt(durationParts[1]) / 60 + parseInt(durationParts[2]) / 3600)
            } else {
              workHoursData.push(null)
            }
          } else {
            workHoursData.push(null)
          }
        } else {
          workHoursData.push(null)
        }

        // 加班时长数据
        if (dayRecord && dayRecord.overtimeDuration) {
          var overtimeParts = dayRecord.overtimeDuration.split(':')
          if (overtimeParts.length === 3) {
            overtimeHoursData.push(parseInt(overtimeParts[0]) + parseInt(overtimeParts[1]) / 60 + parseInt(overtimeParts[2]) / 3600)
          } else {
            overtimeHoursData.push(0)
          }
        } else {
          overtimeHoursData.push(0)
        }
      }
    } else {
      // 按月份筛选
      var [year, month] = this.data.selectedMonth.split('-')
      var firstDay = new Date(parseInt(year), parseInt(month) - 1, 1)
      var lastDay = new Date(parseInt(year), parseInt(month), 0) // 下个月第0天就是这个月最后一天
      
      var currentDay = new Date(firstDay)
      while (currentDay <= lastDay) {
        var fullDateStr = this.formatDate(currentDay)
        var dayRecord = records.find(r => r.date === fullDateStr)
        
        // 格式化日期为 MM-DD
        var day = currentDay.getDate()
        var dateStr = (parseInt(month) < 10 ? '0' + parseInt(month) : month) + '-' + (day < 10 ? '0' + day : day)
        dates.push(dateStr)
        
        // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
        var normalizeTime = function(time) {
          if (!time || typeof time !== 'string') return null
          var timeParts = time.split(':')
          if (timeParts.length === 2) {
            return time + ':00'  // HH:MM -> HH:MM:SS
          } else if (timeParts.length === 3) {
            return time          // HH:MM:SS 保持不变
          } else {
            return null          // 格式异常
          }
        }

        if (dayRecord && dayRecord.clockIn) {
          var normalizedClockIn = normalizeTime(dayRecord.clockIn)
          if (normalizedClockIn) {
            var timeParts = normalizedClockIn.split(':')
            var hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600
            clockInData.push(hours)
          } else {
            clockInData.push(null)
          }
        } else {
          clockInData.push(null)
        }

        if (dayRecord && dayRecord.clockOut) {
          var normalizedClockOut = normalizeTime(dayRecord.clockOut)
          if (normalizedClockOut) {
            var timeParts2 = normalizedClockOut.split(':')
            var hours2 = parseInt(timeParts2[0]) + parseInt(timeParts2[1]) / 60 + parseInt(timeParts2[2]) / 3600
            clockOutData.push(hours2)
          } else {
            clockOutData.push(null)
          }
        } else {
          clockOutData.push(null)
        }

        // 计算工作时长 - 从记录中直接获取或计算
        if (dayRecord && dayRecord.clockIn && dayRecord.clockOut) {
          // 如果记录中已经有duration字段，直接使用
          if (dayRecord.duration) {
            var durationParts = dayRecord.duration.split(':')
            if (durationParts.length === 3) {
              workHoursData.push(parseInt(durationParts[0]) + parseInt(durationParts[1]) / 60 + parseInt(durationParts[2]) / 3600)
            } else {
              workHoursData.push(null)
            }
          } else {
            workHoursData.push(null)
          }
        } else {
          workHoursData.push(null)
        }

        // 加班时长数据
        if (dayRecord && dayRecord.overtimeDuration) {
          var overtimeParts = dayRecord.overtimeDuration.split(':')
          if (overtimeParts.length === 3) {
            overtimeHoursData.push(parseInt(overtimeParts[0]) + parseInt(overtimeParts[1]) / 60 + parseInt(overtimeParts[2]) / 3600)
          } else {
            overtimeHoursData.push(0)
          }
        } else {
          overtimeHoursData.push(0)
        }
        
        currentDay.setDate(currentDay.getDate() + 1)
      }
    }

    this.setData({
      chartData: {
        dates: dates,
        clockInData: clockInData,
        clockOutData: clockOutData,
        workHoursData: workHoursData,
        overtimeHoursData: overtimeHoursData
      }
    })
  },

  // 绘制折线图和柱状图
  drawChart() {
    if (!this.data.chartData) return

    try {
      var ctx = wx.createCanvasContext('timeChart')
      var chartData = this.data.chartData
      var canvasWidth = 360 // 增加宽度以获得更清晰的显示
      var canvasHeight = 260 // 增加高度以获得更清晰的显示
      var padding = 30 // 减少边距，增加图表显示区域
      var rightPadding = 60 // 右侧额外空间给刻度标签
      var chartWidth = canvasWidth - padding - rightPadding
      var chartHeight = canvasHeight - 2 * padding

      // 清空画布并绘制背景
      ctx.setFillStyle('#ffffff')
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // 绘制坐标轴
      ctx.setStrokeStyle('#cccccc')
      ctx.setLineWidth(1)
      
      // Y轴（左侧 - 上下班时间）
      ctx.beginPath()
      ctx.moveTo(padding, padding)
      ctx.lineTo(padding, canvasHeight - padding)
      ctx.stroke()
      
      // 右侧Y轴（工作时长）
      ctx.beginPath()
      ctx.moveTo(canvasWidth - rightPadding + 20, padding)
      ctx.lineTo(canvasWidth - rightPadding + 20, canvasHeight - padding)
      ctx.stroke()
      
      // X轴
      ctx.beginPath()
      ctx.moveTo(padding, canvasHeight - padding)
      ctx.lineTo(canvasWidth - rightPadding, canvasHeight - padding)
      ctx.stroke()

      // 计算实际的时间范围（基于真实数据）
      var allTimeData = []
      allTimeData.push(...chartData.clockInData.filter(t => t !== null))
      allTimeData.push(...chartData.clockOutData.filter(t => t !== null))
      
      var timeAxisMin, timeAxisMax, timeAxisStep
      if (allTimeData.length > 0) {
        var minTime = Math.min(...allTimeData)
        var maxTime = Math.max(...allTimeData)
        
        // 扩展时间范围，让数据有适当的边距
        timeAxisMin = Math.floor(minTime) - 1 // 最小时间前推1小时
        timeAxisMax = Math.ceil(maxTime) + 1    // 最大时间后推1小时
        
        // 确保范围合理（至少4小时，不超过18小时）
        if (timeAxisMax - timeAxisMin < 4) {
          timeAxisMin = Math.floor(minTime) - 2
          timeAxisMax = Math.ceil(maxTime) + 2
        }
        
        // 计算合适的刻度间隔
        var timeRange = timeAxisMax - timeAxisMin
        if (timeRange <= 6) {
          timeAxisStep = 1
        } else if (timeRange <= 12) {
          timeAxisStep = 2
        } else {
          timeAxisStep = 3
        }
        
        // 调整刻度起点为整数小时
        timeAxisMin = Math.floor(timeAxisMin)
        timeAxisMax = Math.ceil(timeAxisMax)
      } else {
        // 默认时间范围
        timeAxisMin = 6
        timeAxisMax = 22
        timeAxisStep = 2
      }
      
      // 绘制左侧Y轴刻度和网格线（上下班时间：自适应范围）
      ctx.setFillStyle('#666666')
      ctx.setFontSize(9)
      for (var i = timeAxisMin; i <= timeAxisMax; i += timeAxisStep) {
        var y = canvasHeight - padding - ((i - timeAxisMin) / (timeAxisMax - timeAxisMin)) * chartHeight
        ctx.fillText(i + ':00', 3, y + 3)
        
        // 绘制网格线
        if (i > timeAxisMin) {
          ctx.setStrokeStyle('#f0f0f0')
          ctx.setLineWidth(0.5)
          ctx.beginPath()
          ctx.moveTo(padding, y)
          ctx.lineTo(canvasWidth - rightPadding + 20, y)
          ctx.stroke()
        }
      }

      // 计算工作时长数据的自适应刻度范围
      var workHoursData = chartData.workHoursData.filter(h => h !== null)
      var maxWorkHours = Math.max(...workHoursData, 10)
      var minWorkHours = Math.min(...workHoursData, 0)
      
      // 自适应刻度范围，让数据显示更合理
      var workAxisMin = 0 // 确保工作时长从0开始，避免负数柱状图
      var workAxisMax, workAxisStep
      
      var range = maxWorkHours - workAxisMin
      if (range <= 4) {
        // 小范围：最大值+1小时余量
        workAxisMax = Math.max(maxWorkHours + 1, 4)
        workAxisStep = 0.5
      } else if (range <= 8) {
        // 中等范围：最大值+2小时余量
        workAxisMax = Math.max(maxWorkHours + 2, 8)
        workAxisStep = 1
      } else {
        // 大范围：最大值+3小时余量
        workAxisMax = Math.max(maxWorkHours + 3, 12)
        workAxisStep = 2
      }
      
      // 向上取整到合适的刻度值
      if (workAxisStep === 0.5) {
        workAxisMax = Math.ceil(workAxisMax * 2) / 2
      } else if (workAxisStep === 1) {
        workAxisMax = Math.ceil(workAxisMax)
      } else {
        workAxisMax = Math.ceil(workAxisMax / 2) * 2
      }
      
      // 绘制右侧Y轴刻度（工作时长：自适应范围）
      ctx.setFillStyle('#007aff') // 蓝色，对应柱状图颜色
      ctx.setFontSize(9)
      for (var h = workAxisMin; h <= workAxisMax; h += workAxisStep) {
        var y = canvasHeight - padding - ((h - workAxisMin) / (workAxisMax - workAxisMin)) * chartHeight
        ctx.fillText(h + 'h', canvasWidth - rightPadding + 25, y + 3) // 使用新的右边距
      }

      // 绘制X轴刻度（日期）
      ctx.setFillStyle('#666666')
      ctx.setFontSize(8) // 稍微缩小字体以适应更多信息
      var step = Math.ceil(chartData.dates.length / 8) // 最多显示8个标签
      for (var j = 0; j < chartData.dates.length; j += step) {
        var x = padding + (j / (chartData.dates.length - 1)) * chartWidth
        ctx.save()
        
        // 处理包含换行的日期标签
        var dateLabel = chartData.dates[j]
        if (dateLabel.includes('\n')) {
          var lines = dateLabel.split('\n')
          ctx.translate(x, canvasHeight - padding + 20)
          ctx.rotate(-Math.PI / 6) // 减小旋转角度到30度
          ctx.fillText(lines[0], 0, 0) // 第一行
          ctx.fillText(lines[1], 0, 10) // 第二行
        } else {
          ctx.translate(x, canvasHeight - padding + 15)
          ctx.rotate(-Math.PI / 4) // 旋转45度避免重叠
          ctx.fillText(dateLabel, 0, 0)
        }
        ctx.restore()
      }

      // 绘制工作时长柱状图（背景层）
      if (chartData.workHoursData && workAxisMin !== undefined) {
        var barWidth = chartWidth / chartData.dates.length * 0.6 // 柱子宽度
        
        for (var b = 0; b < chartData.workHoursData.length; b++) {
          if (chartData.workHoursData[b] !== null) {
            var x = padding + (b / (chartData.dates.length - 1)) * chartWidth - barWidth / 2
            var height = (chartData.workHoursData[b] / workAxisMax) * chartHeight // 从0开始计算高度
            var y = canvasHeight - padding - height
            
            // 绘制柱子
            ctx.setFillStyle('rgba(0, 122, 255, 0.4)') // 增加透明度
            ctx.fillRect(x, y, barWidth, height)
          }
        }
      }

      // 绘制加班时长柱状图（叠加层）
      if (chartData.overtimeHoursData && chartData.overtimeHoursData.length > 0) {
        var overtimeBarWidth = chartWidth / chartData.dates.length * 0.3 // 加班柱子宽度较小
        
        for (var ob = 0; ob < chartData.overtimeHoursData.length; ob++) {
          if (chartData.overtimeHoursData[ob] > 0) {
            var ox = padding + (ob / (chartData.dates.length - 1)) * chartWidth + chartWidth / chartData.dates.length * 0.3 // 叠加在主工作时长旁边
            var oheight = (chartData.overtimeHoursData[ob] / workAxisMax) * chartHeight
            var oy = canvasHeight - padding - oheight
            
            // 绘制加班柱子
            ctx.setFillStyle('rgba(255, 107, 53, 0.6)') // 橙色，透明度更高
            ctx.fillRect(ox, oy, overtimeBarWidth, oheight)
          }
        }
      }

      // 绘制上班时间折线
      var validClockInPoints = []
      for (var k = 0; k < chartData.clockInData.length; k++) {
        if (chartData.clockInData[k] !== null) {
          validClockInPoints.push({
            x: padding + (k / (chartData.dates.length - 1)) * chartWidth,
            y: canvasHeight - padding - ((chartData.clockInData[k] - timeAxisMin) / (timeAxisMax - timeAxisMin)) * chartHeight
          })
        }
      }

      if (validClockInPoints.length > 0) {
        // 绘制折线
        ctx.setStrokeStyle('#1aad19')
        ctx.setLineWidth(2)
        ctx.beginPath()
        ctx.moveTo(validClockInPoints[0].x, validClockInPoints[0].y)
        for (var p = 1; p < validClockInPoints.length; p++) {
          ctx.lineTo(validClockInPoints[p].x, validClockInPoints[p].y)
        }
        ctx.stroke()

        // 绘制数据点
        ctx.setFillStyle('#1aad19')
        for (var q = 0; q < validClockInPoints.length; q++) {
          ctx.beginPath()
          ctx.arc(validClockInPoints[q].x, validClockInPoints[q].y, 4, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      // 绘制下班时间折线
      var validClockOutPoints = []
      for (var m = 0; m < chartData.clockOutData.length; m++) {
        if (chartData.clockOutData[m] !== null) {
          validClockOutPoints.push({
            x: padding + (m / (chartData.dates.length - 1)) * chartWidth,
            y: canvasHeight - padding - ((chartData.clockOutData[m] - timeAxisMin) / (timeAxisMax - timeAxisMin)) * chartHeight
          })
        }
      }

      if (validClockOutPoints.length > 0) {
        // 绘制折线
        ctx.setStrokeStyle('#e64340')
        ctx.setLineWidth(2)
        ctx.beginPath()
        ctx.moveTo(validClockOutPoints[0].x, validClockOutPoints[0].y)
        for (var r = 1; r < validClockOutPoints.length; r++) {
          ctx.lineTo(validClockOutPoints[r].x, validClockOutPoints[r].y)
        }
        ctx.stroke()

        // 绘制数据点
        ctx.setFillStyle('#e64340')
        for (var s = 0; s < validClockOutPoints.length; s++) {
          ctx.beginPath()
          ctx.arc(validClockOutPoints[s].x, validClockOutPoints[s].y, 4, 0, 2 * Math.PI)
          ctx.fill()
        }
      }

      ctx.draw()

    } catch (error) {
      console.error('绘制图表失败:', error)
      wx.showToast({
        title: '图表绘制失败',
        icon: 'none'
      })
    }
  },

  // 分享给好友
  onShareAppMessage() {
    const totalDays = this.data.stats.totalDays
    return {
      title: `我的工作统计 - 共打卡${totalDays}天`,
      path: '/pages/stats/stats',
      imageUrl: '' // 可以设置分享图片，留空使用默认截图
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '我的工作统计数据 - 劳动时间记录小程序',
      imageUrl: '' // 可以设置分享图片，留空使用默认截图
    }
  }
})