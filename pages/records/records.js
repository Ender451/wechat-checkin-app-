
// records.js
Page({
  data: {
    groupedRecords: [], // 按日期分组的记录
    selectedMonth: '', // 选中的月份
    touchStartX: 0, // 触摸起始位置
    touchEndX: 0, // 触摸结束位置
    currentSwipeIndex: -1, // 当前滑动的项索引
    isSwiping: false, // 是否正在滑动
    touchStartTime: 0 // 触摸开始时间
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

  // 迁移历史数据，确保所有时间都包含秒数
  migrateOldData() {
    try {
      const records = wx.getStorageSync('clockRecords') || []
      let hasChanges = false
      
      const migratedRecords = records.map(record => {
        if (record.time && typeof record.time === 'string') {
          const timeParts = record.time.split(':')
          if (timeParts.length === 2) {
            // HH:MM 格式，补充秒数
            hasChanges = true
            return {
              ...record,
              time: record.time + ':00'
            }
          }
        }
        return record
      })
      
      if (hasChanges) {
        wx.setStorageSync('clockRecords', migratedRecords)
        console.log('历史数据迁移完成，补充了秒数格式')
      }
    } catch (error) {
      console.error('数据迁移失败:', error)
    }
  },

  onLoad() {
    this.initializeSelectedMonth()
    this.migrateOldData() // 迁移历史数据
    this.loadRecords()
  },

  onShow() {
    this.loadRecords()
  },

  // 初始化选中的月份
  initializeSelectedMonth() {
    const now = new Date()
    const currentMonth = now.getFullYear() + '-' + ((now.getMonth() + 1) < 10 ? '0' + (now.getMonth() + 1) : (now.getMonth() + 1))
    this.setData({
      selectedMonth: currentMonth
    })
  },

  // 月份选择变化
  onMonthChange(e) {
    this.setData({
      selectedMonth: e.detail.value
    })
    this.loadRecords()
  },

  // 重置到最近30天记录
  resetToRecent() {
    this.setData({
      selectedMonth: ''
    })
    this.loadRecords()
  },

  loadRecords() {
    const records = wx.getStorageSync('clockRecords') || []
    
    // 生成日期范围
    const dateRange = this.generateDateRange()
    
    // 为每个日期获取对应的打卡记录
    const allDateRecords = dateRange.map(date => {
      const dateRecords = records.filter(record => record.date === date)
      const group = {
        date: date,
        dateStr: '',
        weekDay: '',
        clockIn: '',
        clockOut: '',
        duration: '',
        slideOffset: 0 // 初始化滑动偏移量
      }
      
      // 填充打卡记录
      dateRecords.forEach(record => {
        if (record.type === '上班') {
          group.clockIn = this.formatTimeForDisplay(record.time)
        } else if (record.type === '下班') {
          group.clockOut = this.formatTimeForDisplay(record.time)
        }
      })
      
      return group
    })
    
    // 格式化日期信息并计算工作时长
    allDateRecords.forEach(group => {
      const dateObj = new Date(group.date)
      const month = dateObj.getMonth() + 1
      const day = dateObj.getDate()
      group.dateStr = (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day)
      
      // 计算周几
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      group.weekDay = weekDays[dateObj.getDay()]
      
      // 计算工作时长
      if (group.clockIn && group.clockOut) {
        group.duration = this.calculateDuration(group.clockIn, group.clockOut)
      }
    })
    
    this.setData({ groupedRecords: allDateRecords })
  },

  // 生成日期范围
  generateDateRange() {
    const now = new Date()
    const dates = []
    
    if (this.data.selectedMonth && this.data.selectedMonth !== '') {
      // 按选择的月份生成
      const [year, month] = this.data.selectedMonth.split('-')
      const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1)
      const lastDay = new Date(parseInt(year), parseInt(month), 0) // 下个月第0天就是这个月最后一天
      
      // 如果是当前月份，只显示到今天为止
      const isCurrentMonth = (parseInt(year) === now.getFullYear() && parseInt(month) === now.getMonth() + 1)
      const endDate = isCurrentMonth ? now : lastDay
      
      // 从月末到月初倒序生成日期
      const currentDay = new Date(endDate)
      while (currentDay >= firstDay) {
        dates.push(this.formatDate(currentDay))
        currentDay.setDate(currentDay.getDate() - 1)
      }
    } else {
      // 显示最近30天，从今天开始倒序
      for (let i = 0; i < 30; i++) {
        const date = new Date(now)
        date.setDate(now.getDate() - i)
        dates.push(this.formatDate(date))
      }
    }
    
    return dates
  },



  // 计算工作时长(小时:分钟)
  calculateDuration(start, end) {
    if (!start || !end) {
      return ''
    }
    
    // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
    const normalizeTime = (time) => {
      const timeParts = time.split(':')
      if (timeParts.length === 2) {
        // HH:MM 格式，补充秒数
        return time + ':00'
      } else if (timeParts.length === 3) {
        // HH:MM:SS 格式，直接返回
        return time
      } else {
        console.log('calculateDuration: 时间格式不正确', time)
        return null
      }
    }
    
    const normalizedStart = normalizeTime(start)
    const normalizedEnd = normalizeTime(end)
    
    if (!normalizedStart || !normalizedEnd) {
      return ''
    }
    
    var startParts = normalizedStart.split(':')
    var endParts = normalizedEnd.split(':')
    var startHour = parseInt(startParts[0])
    var startMinute = parseInt(startParts[1])
    var startSecond = parseInt(startParts[2])
    var endHour = parseInt(endParts[0])
    var endMinute = parseInt(endParts[1])
    var endSecond = parseInt(endParts[2])
    
    // 检查时间数值是否有效
    if (isNaN(startHour) || isNaN(startMinute) || isNaN(startSecond) ||
        isNaN(endHour) || isNaN(endMinute) || isNaN(endSecond)) {
      console.log('calculateDuration: 时间数值无效', normalizedStart, normalizedEnd)
      return ''
    }
    
    // 转换为总秒数进行计算
    var startTotalSeconds = startHour * 3600 + startMinute * 60 + startSecond
    var endTotalSeconds = endHour * 3600 + endMinute * 60 + endSecond
    
    var totalSeconds = endTotalSeconds - startTotalSeconds
    if (totalSeconds < 0) totalSeconds += 24 * 3600 // 处理跨天情况
    
    var hours = Math.floor(totalSeconds / 3600)
    var remainingSeconds = totalSeconds % 3600
    var minutes = Math.floor(remainingSeconds / 60)
    
    return hours + '小时' + minutes + '分钟'
  },

  // 触摸开始
  touchStart(e) {
    if (e.touches && e.touches[0]) {
      const touch = e.touches[0]
      this.setData({
        touchStartX: touch.clientX,
        touchEndX: touch.clientX,
        currentSwipeIndex: parseInt(e.currentTarget.dataset.index),
        isSwiping: false,
        touchStartTime: Date.now() // 记录触摸开始时间
      })
    }
  },

  // 触摸移动
  touchMove(e) {
    if (!e.touches || !e.touches[0]) return
    
    const touch = e.touches[0]
    const moveX = touch.clientX - this.data.touchStartX
    const index = parseInt(e.currentTarget.dataset.index)
    
    // 只有滑动距离足够大才标记为滑动状态
    if (Math.abs(moveX) > 5) {
      this.setData({ isSwiping: true })
    }
    
    // 允许左右滑动：向左滑动显示删除按钮，向右滑动恢复原位
    if (moveX < 0 && moveX > -80) {
      // 向左滑动，显示删除按钮
      const updatedRecords = [...this.data.groupedRecords]
      updatedRecords[index].slideOffset = moveX
      
      // 重置其他项的滑动状态
      updatedRecords.forEach((item, i) => {
        if (i !== index) {
          item.slideOffset = 0
        }
      })
      
      this.setData({ groupedRecords: updatedRecords })
    } else if (moveX > 0) {
      // 向右滑动，恢复原位
      const updatedRecords = [...this.data.groupedRecords]
      updatedRecords[index].slideOffset = 0
      
      this.setData({ groupedRecords: updatedRecords })
    }
  },

  // 触摸结束
  touchEnd(e) {
    const touchEndTime = Date.now()
    const touchDuration = touchEndTime - this.data.touchStartTime
    
    if (e.changedTouches && e.changedTouches[0]) {
      const touch = e.changedTouches[0]
      this.setData({
        touchEndX: touch.clientX
      })
    }
    
    const index = this.data.currentSwipeIndex
    const updatedRecords = [...this.data.groupedRecords]
    
    if (updatedRecords[index]) {
      const currentOffset = updatedRecords[index].slideOffset
      
      if (currentOffset < -40) {
        // 向左滑动距离超过阈值，完全显示删除按钮
        updatedRecords[index].slideOffset = -80
      } else {
        // 其他情况回弹到原位
        updatedRecords[index].slideOffset = 0
      }
    }
    
    this.setData({ 
      groupedRecords: updatedRecords,
      currentSwipeIndex: -1
    })
    
    // 如果触摸时间很短且滑动距离小，不标记为滑动状态
    if (touchDuration < 200 && Math.abs(this.data.touchEndX - this.data.touchStartX) < 10) {
      this.setData({ isSwiping: false })
    } else {
      // 延迟重置滑动状态，避免影响点击事件
      setTimeout(() => {
        this.setData({ isSwiping: false })
      }, 100)
    }
  },

  // 编辑记录 - 点击整行跳转
  editRecord(e) {
    console.log('editRecord called, isSwiping:', this.data.isSwiping)
    
    // 如果是滑动操作，不执行编辑
    if (this.data.isSwiping) {
      console.log('滑动中，不执行编辑')
      return
    }
    
    const index = e.currentTarget.dataset.index
    const record = this.data.groupedRecords[index]
    
    console.log('跳转到编辑页面，日期:', record.date)
    
    wx.navigateTo({
      url: `/pages/edit/edit?date=${record.date}`
    })
  },

  // 删除记录
  deleteRecord(e) {
    const index = e.currentTarget.dataset.index
    const record = this.data.groupedRecords[index]
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除 ${record.dateStr} (${record.weekDay}) 的所有打卡记录吗？`,
      success: (res) => {
        if (res.confirm) {
          this.performDelete(record.date)
        }
        // 无论是否删除，都重置滑动状态
        this.resetSlideState()
      }
    })
  },

  // 重置滑动状态
  resetSlideState() {
    const updatedRecords = this.data.groupedRecords.map(item => ({
      ...item,
      slideOffset: 0
    }))
    this.setData({ groupedRecords: updatedRecords })
  },

  // 执行删除操作
  performDelete(date) {
    try {
      // 获取所有记录
      const records = wx.getStorageSync('clockRecords') || []
      
      // 过滤掉指定日期的记录
      const filteredRecords = records.filter(record => record.date !== date)
      
      // 保存过滤后的记录
      wx.setStorageSync('clockRecords', filteredRecords)
      
      // 重新加载列表
      this.loadRecords()
      
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      })
    } catch (error) {
      console.error('删除记录失败:', error)
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      })
    }
  }
})