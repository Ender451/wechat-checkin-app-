
// edit.js
Page({
  data: {
    date: '',          // 当前编辑的日期
    clockIn: '',       // 上班时间
    clockOut: ''       // 下班时间
  },

  // 统一的日期格式化方法 - 返回 YYYY/MM/DD 格式
  formatDate(date) {
    const d = date || new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return year + '/' + (month < 10 ? '0' + month : month) + '/' + (day < 10 ? '0' + day : day)
  },

  onLoad(options) {
    // 加载现有记录
    if (options.date) {
      this.loadRecords(options.date)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 加载指定日期的记录
  loadRecords(date) {
    const records = wx.getStorageSync('clockRecords') || []
    const dateRecords = records.filter(r => r.date === date)
    
    let clockIn = '', clockOut = ''
    dateRecords.forEach(r => {
      if (r.type === '上班') clockIn = this.formatTimeForPicker(r.time)
      if (r.type === '下班') clockOut = this.formatTimeForPicker(r.time)
    })
    
    this.setData({ 
      date,
      clockIn,
      clockOut
    })
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

  // 上班时间选择
  onClockInChange(e) {
    this.setData({
      clockIn: e.detail.value
    })
  },

  // 下班时间选择
  onClockOutChange(e) {
    this.setData({
      clockOut: e.detail.value
    })
  },

  // 验证时间逻辑
  validateTime(clockIn, clockOut) {
    if (!clockIn || !clockOut) return true
    
    const [inHour, inMinute] = clockIn.split(':').map(Number)
    const [outHour, outMinute] = clockOut.split(':').map(Number)
    
    const inMinutes = inHour * 60 + inMinute
    const outMinutes = outHour * 60 + outMinute
    
    if (outMinutes < inMinutes) {
      wx.showToast({ 
        title: '下班时间不能早于上班时间', 
        icon: 'none' 
      })
      return false
    }
    
    return true
  },

  // 保存修改
  saveRecords() {
    const { date, clockIn, clockOut } = this.data
    
    // 验证数据
    if (!date) {
      wx.showToast({ title: '日期不能为空', icon: 'none' })
      return
    }

    // 验证时间逻辑
    if (!this.validateTime(clockIn, clockOut)) {
      return
    }

    // 更新存储
    let records = wx.getStorageSync('clockRecords') || []
    records = records.filter(r => r.date !== date) // 移除旧记录
    
    // 为时间添加秒数（编辑页面使用的时间选择器只有时分，需要补充秒）
    const formatTimeWithSeconds = (time) => {
      if (!time) return time
      // 如果已经有秒数，直接返回
      if (time.split(':').length === 3) return time
      // 补充秒数
      return time + ':00'
    }
    
    if (clockIn) records.push({ date, type: '上班', time: formatTimeWithSeconds(clockIn) })
    if (clockOut) records.push({ date, type: '下班', time: formatTimeWithSeconds(clockOut) })
    
    wx.setStorageSync('clockRecords', records)
    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1000)
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