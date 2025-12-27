
// edit.js
Page({
  data: {
    date: '',                // 当前编辑的日期
    periods: [],            // 工作时段列表
    periodTypes: [          // 时段类型选项
      { value: 'main', label: '主时段' },
      { value: 'overtime', label: '加班时段' }
    ],
    totalDuration: '',       // 总工作时长
    mainDuration: '',        // 主工作时长
    overtimeDuration: '',     // 加班时长
    conflictIndex: -1       // 冲突时段的索引
  },

  // 统一的日期格式化方法 - 返回 YYYY/MM/DD 格式
  formatDate(date) {
    const d = date || new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return year + '/' + (month < 10 ? '0' + month : month) + '/' + (day < 10 ? '0' + day : day)
  },

  // 标准化记录的日期格式（用于处理存储的数据）
  normalizeRecordDate(record) {
    if (!record || !record.date || typeof record.date !== 'string') {
      return record
    }
    
    const normalized = { ...record }
    
    // 处理各种分隔符
    let normalizedDate = normalized.date.replace(/-/g, '/')
    
    // 分割日期部分并补零
    const dateParts = normalizedDate.split('/')
    if (dateParts.length === 3) {
      const year = dateParts[0]
      const month = dateParts[1].padStart(2, '0')
      const day = dateParts[2].padStart(2, '0')
      normalizedDate = `${year}/${month}/${day}`
      
      if (normalizedDate !== normalized.date) {
        normalized.date = normalizedDate
      }
    }
    
    return normalized
  },

  onLoad(options) {
    // 加载现有记录
    if (options.date) {
      // 判断是否为今天
      const today = this.formatDate(new Date())
      const isToday = options.date === today
      
      this.setData({ isToday })
      this.loadRecords(options.date, options.periodIndex)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载指定日期的记录
  loadRecords(date, targetPeriodIndex) {
    const records = wx.getStorageSync('clockRecords') || []
    const todayRecord = records.find(r => {
      const normalizedRecord = this.normalizeRecordDate(r)
      return normalizedRecord.date === date
    })
    
    let periods = []
    
    if (todayRecord && todayRecord.periods && Array.isArray(todayRecord.periods)) {
      // 新格式：多时段记录
      periods = todayRecord.periods.map((period, index) => ({
        id: index + 1,
        type: period.type || 'main',
        typeIndex: (period.type || 'main') === 'main' ? 0 : 1,
        clockIn: this.formatTimeForPicker(period.clockIn),
        clockOut: this.formatTimeForPicker(period.clockOut),
        duration: period.duration
      }))
    } else if (todayRecord && todayRecord.type) {
      // 旧格式：单条记录
      if (todayRecord.type === '上班') {
        periods.push({
          id: 1,
          type: 'main',
          clockIn: this.formatTimeForPicker(todayRecord.time),
          clockOut: '',
          duration: null
        })
      }
    } else {
      // 查找旧格式的上下班记录对
      const dateRecords = records.filter(r => {
        const normalizedRecord = this.normalizeRecordDate(r)
        return normalizedRecord.date === date
      })
      
      const clockInRecord = dateRecords.find(r => r.type === '上班')
      const clockOutRecord = dateRecords.find(r => r.type === '下班')
      
      if (clockInRecord) {
      periods.push({
        id: 1,
        type: 'main',
        typeIndex: 0,
        clockIn: this.formatTimeForPicker(clockInRecord.time),
        clockOut: clockOutRecord ? this.formatTimeForPicker(clockOutRecord.time) : '',
        duration: null
      })
      }
    }
    
    // 如果指定了时段索引，滚动到对应位置并高亮
    if (targetPeriodIndex !== undefined && periods[targetPeriodIndex]) {
      // 可以在这里添加高亮逻辑或滚动逻辑
      console.log('编辑指定时段:', targetPeriodIndex)
    }
    
    this.setData({ 
      date,
      periods
    })
    
    // 更新统计信息
    this.updateStatistics()
  },

  // 格式化时间用于picker显示 - 只显示小时和分钟，兼容 HH:MM 和 HH:MM:SS 格式
  formatTimeForPicker(time) {
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

  // 添加时段
  addPeriod() {
    const newPeriod = {
      id: Date.now(), // 使用时间戳作为唯一ID
      type: 'main', // 默认为主时段
      typeIndex: 0,
      clockIn: '',
      clockOut: '',
      duration: null
    }
    
    this.setData({
      periods: [...this.data.periods, newPeriod]
    })
    
    this.updateStatistics()
  },

  // 时段类型切换
  onPeriodTypeChange(e) {
    const index = e.currentTarget.dataset.index
    const valueIndex = parseInt(e.detail.value)
    const periodType = this.data.periodTypes[valueIndex].value
    
    const periods = this.data.periods.map((period, i) => {
      if (i === index) {
        return { ...period, type: periodType, typeIndex: valueIndex }
      }
      return period
    })
    
    this.setData({ periods })
    this.updateStatistics()
  },

  // 删除时段
  deletePeriod(e) {
    const index = e.currentTarget.dataset.index
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个工作时段吗？',
      success: (res) => {
        if (res.confirm) {
          const periods = this.data.periods.filter((_, i) => i !== index)
          this.setData({ periods })
          this.updateStatistics()
        }
      }
    })
  },

  // 开始时间选择
  onClockInChange(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const periods = this.data.periods.map((period, i) => {
      if (i === index) {
        return { ...period, clockIn: value }
      }
      return period
    })
    
    this.setData({ periods })
    
    // 实时验证时间冲突
    this.validateTimeConflict(periods, index)
    
    this.updateStatistics()
  },

  // 结束时间选择
  onClockOutChange(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const periods = this.data.periods.map((period, i) => {
      if (i === index) {
        return { ...period, clockOut: value }
      }
      return period
    })
    
    this.setData({ periods })
    
    // 实时验证时间冲突
    this.validateTimeConflict(periods, index)
    
    this.updateStatistics()
  },

  // 实时验证时间冲突
  validateTimeConflict(periods, changedIndex) {
    const changedPeriod = periods[changedIndex]
    
    // 如果时间段不完整，不进行验证
    if (!changedPeriod.clockIn || !changedPeriod.clockOut || changedPeriod.clockOut === '') {
      this.setData({ conflictIndex: -1 })
      return
    }
    
    // 检查与其他时段的冲突
    const [inHour, inMinute] = changedPeriod.clockIn.split(':').map(Number)
    const [outHour, outMinute] = changedPeriod.clockOut.split(':').map(Number)
    const newStart = inHour * 60 + inMinute
    const newEnd = outHour * 60 + outMinute
    
    let conflictFound = false
    
    for (let i = 0; i < periods.length; i++) {
      if (i === changedIndex) continue
      
      const otherPeriod = periods[i]
      if (!otherPeriod.clockIn || !otherPeriod.clockOut) continue
      
      const [otherInHour, otherInMinute] = otherPeriod.clockIn.split(':').map(Number)
      const [otherOutHour, otherOutMinute] = otherPeriod.clockOut.split(':').map(Number)
      const otherStart = otherInHour * 60 + otherInMinute
      const otherEnd = otherOutHour * 60 + otherOutMinute
      
      // 检查时间重叠或包含（允许时间端点相连）
      // 重叠条件：两个区间有任何交集，包括包含关系
      // 允许端点相接：newEnd === otherStart 或 otherEnd === newStart
      if (!(newEnd <= otherStart || otherEnd <= newStart)) {
        const currentPeriod = changedPeriod.type === 'main' ? '主时段' : '加班时段'
        const otherPeriodType = otherPeriod.type === 'main' ? '主时段' : '加班时段'
        
        wx.showToast({ 
          title: `时间冲突\n${currentPeriod}: ${changedPeriod.clockIn}-${changedPeriod.clockOut}\n与\n第${i + 1}个${otherPeriodType}: ${otherPeriod.clockIn}-${otherPeriod.clockOut}\n发生重叠`, 
          icon: 'none',
          duration: 2000
        })
        
        conflictFound = true
        break
      }
    }
    
    // 更新冲突状态
    this.setData({ conflictIndex: conflictFound ? changedIndex : -1 })
    
    // 如果有冲突，恢复时间
    if (conflictFound) {
      setTimeout(() => {
        this.resetChangedPeriod(changedIndex)
      }, 2000)
    }
  },

  // 重置修改的时段
  resetChangedPeriod(index) {
    const periods = this.data.periods.map((period, i) => {
      if (i === index) {
        // 这里可以保存之前的值，或者重置为空
        return { ...period, clockIn: '', clockOut: '' }
      }
      return period
    })
    
    this.setData({ periods })
    this.updateStatistics()
  },

  // 更新统计信息
  updateStatistics() {
    const periods = this.data.periods
    let totalSeconds = 0
    let mainSeconds = 0
    let overtimeSeconds = 0

    periods.forEach(period => {
      if (period.clockIn && period.clockOut && period.clockOut !== '') {
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
      }
    })

    this.setData({
      totalDuration: this.formatDuration(totalSeconds),
      mainDuration: this.formatDuration(mainSeconds),
      overtimeDuration: this.formatDuration(overtimeSeconds)
    })
  },

  // 计算时段时长
  calculatePeriodDuration(clockIn, clockOut) {
    if (!clockIn || !clockOut) return null
    
    const [inHour, inMinute] = clockIn.split(':').map(Number)
    const [outHour, outMinute] = clockOut.split(':').map(Number)
    
    const inMinutes = inHour * 60 + inMinute
    const outMinutes = outHour * 60 + outMinute
    
    if (outMinutes < inMinutes) {
      return null // 下班时间早于上班时间
    }
    
    const diffMinutes = outMinutes - inMinutes
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  },

  // 格式化时长显示
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0分钟'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else {
      return `${minutes}分钟`
    }
  },

  // 验证时段逻辑
  validatePeriods() {
    const periods = this.data.periods
    

    
    // 检查是否有时段
    if (periods.length === 0) {
      wx.showToast({ 
        title: '请至少添加一个工作时段', 
        icon: 'none' 
      })
      return false
    }
    
    // 检查每个时段的时间逻辑
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i]

      
      // 检查是否填写了开始时间
      if (!period.clockIn) {
        wx.showToast({ 
          title: `第${i + 1}个时段的开始时间不能为空`, 
          icon: 'none' 
        })
        return false
      }
      
      // 如果没有结束时间，说明是进行中状态，这是允许的
      if (!period.clockOut || period.clockOut === '') {

        continue
      }
      
      // 检查时间逻辑（只有当结束时间存在时才检查）
      const [inHour, inMinute] = period.clockIn.split(':').map(Number)
      const [outHour, outMinute] = period.clockOut.split(':').map(Number)
      
      const inMinutes = inHour * 60 + inMinute
      const outMinutes = outHour * 60 + outMinute
      
      if (outMinutes < inMinutes) {
        wx.showToast({ 
          title: `第${i + 1}个时段的结束时间不能早于开始时间`, 
          icon: 'none' 
        })
        return false
      }
    }
    
    // 只有当所有时段都有结束时间时才检查时间区间交叉
    const completePeriods = periods.filter(p => p.clockIn && p.clockOut)
    if (completePeriods.length > 1 && !this.validateTimeOverlap(completePeriods)) {
      return false
    }
    

    return true
  },

  // 验证时间区间交叉
  validateTimeOverlap(periods) {
    // 过滤出有完整时间的时段
    const completePeriods = periods.filter(p => p.clockIn && p.clockOut && p.clockOut !== '')
    
    // 如果没有或只有一个完整时段，不需要检查重叠
    if (completePeriods.length <= 1) {
      return true
    }
    
    // 将时间段转换为分钟区间进行排序
    const timeRanges = completePeriods.map(period => {
      const [inHour, inMinute] = period.clockIn.split(':').map(Number)
      const [outHour, outMinute] = period.clockOut.split(':').map(Number)
      
      return {
        start: inHour * 60 + inMinute,
        end: outHour * 60 + outMinute,
        period: period
      }
    })
    
    // 按开始时间排序
    timeRanges.sort((a, b) => a.start - b.start)
    
    // 检查所有时间区间之间的重叠关系（包括包含关系）
    for (let i = 0; i < timeRanges.length; i++) {
      const current = timeRanges[i]
      
      // 与当前时段之后的所有时段进行比较
      for (let j = i + 1; j < timeRanges.length; j++) {
        const other = timeRanges[j]
        
        // 检查是否有时间重叠或包含
        // 重叠条件：两个区间有任何交集
        // 允许端点相接：current.end === other.start 或 other.end === current.start
        if (!(current.end <= other.start || other.end <= current.start)) {
          const currentPeriod = current.period.type === 'main' ? '主时段' : '加班时段'
          const otherPeriod = other.period.type === 'main' ? '主时段' : '加班时段'
          
          wx.showToast({ 
            title: `时间区间重叠\n${currentPeriod}: ${current.period.clockIn}-${current.period.clockOut}\n与\n${otherPeriod}: ${other.period.clockIn}-${other.period.clockOut}\n发生重叠`, 
            icon: 'none',
            duration: 3000
          })
          return false
        }
      }
    }
    
    return true
  },

  // 保存修改
  saveRecords() {
    const { date, periods } = this.data
    
    // 验证数据
    if (!date) {
      wx.showToast({ title: '日期不能为空', icon: 'none' })
      return
    }

    // 验证时段数据
    if (!this.validatePeriods()) {
      return
    }

    // 格式化时间数据
    const formatTimeWithSeconds = (time) => {
      if (!time) return time
      // 如果已经有秒数，直接返回
      if (time.split(':').length === 3) return time
      // 补充秒数
      return time + ':00'
    }

    // 构建时段数据
    const formattedPeriods = periods.map(period => {
      const formattedPeriod = {
        type: period.type,
        clockIn: formatTimeWithSeconds(period.clockIn),
        clockOut: formatTimeWithSeconds(period.clockOut)
      }
      
      // 只有当开始时间和结束时间都存在且不为空时才计算时长
      if (period.clockIn && period.clockOut && period.clockOut !== '') {
        formattedPeriod.duration = this.calculatePeriodDuration(period.clockIn, period.clockOut)
      }
      
      return formattedPeriod
    })

    // 更新存储
    let records = wx.getStorageSync('clockRecords') || []
    
    // 移除该日期的旧记录（包括新格式和旧格式）
    records = records.filter(r => {
      const normalizedRecord = this.normalizeRecordDate(r)
      return normalizedRecord.date !== date
    })
    
    // 创建新格式的记录
    const newRecord = {
      date: date,
      periods: formattedPeriods,
      totalWorkTime: this.calculateTotalWorkTime(formattedPeriods)
    }
    
    records.push(newRecord)
    wx.setStorageSync('clockRecords', records)
    
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1000)
  },

  // 计算总工作时长
  calculateTotalWorkTime(periods) {
    let totalSeconds = 0
    
    periods.forEach(period => {
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

  // 删除记录
  deleteRecord() {
    const { date } = this.data
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${date} 的所有打卡记录吗？`,
      success: (res) => {
        if (res.confirm) {
          this.performDelete()
        }
      }
    })
  },

  // 执行删除操作
  performDelete() {
    try {
      const { date } = this.data
      let records = wx.getStorageSync('clockRecords') || []
      
      // 过滤掉指定日期的记录
      records = records.filter(r => r.date !== date)
      
      // 保存到存储
      wx.setStorageSync('clockRecords', records)
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
      
      setTimeout(() => wx.navigateBack(), 1000)
    } catch (error) {
      console.error('删除失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      })
    }
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack()
  }
})