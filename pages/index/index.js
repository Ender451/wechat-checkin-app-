
// index.js
Page({
  data: {
    lastAction: '欢迎使用劳动时间记录', // 上次操作类型
    currentTime: '', // 当前时间
    currentDate: '', // 当前日期
    workDuration: '0秒', // 工作时长（始终显示）
    clockedIn: false, // 是否已上班打卡
    clockInTime: null, // 上班打卡时间
    clockedOut: false // 是否已下班打卡
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

  // 检查是否已存在当天的同类型打卡记录
  hasRecordForToday(type) {
    const today = this.formatDate()
    const records = wx.getStorageSync('clockRecords') || []
    return records.some(
      record => record.date === today && record.type === type
    )
  },

  // 获取今天上班打卡时间
  getTodayClockIn() {
    const today = this.formatDate()
    const records = wx.getStorageSync('clockRecords') || []
    console.log('getTodayClockIn: 今天日期', today)
    console.log('getTodayClockIn: 所有记录', records)
    
    const clockInRecord = records.find(
      record => record.date === today && record.type === '上班'
    )
    console.log('getTodayClockIn: 找到的上班记录', clockInRecord)
    return clockInRecord ? clockInRecord.time : null
  },

  // 计算工作时长（精确到秒）
  calculateWorkDuration(clockInTime) {
    // 验证输入参数
    if (!clockInTime || typeof clockInTime !== 'string') {
      console.log('calculateWorkDuration: 无效的输入参数', clockInTime)
      return '0秒'
    }
    
    // 标准化时间格式，支持 HH:MM 和 HH:MM:SS
    const normalizeTime = (time) => {
      const timeParts = time.split(':')
      if (timeParts.length === 2) {
        // HH:MM 格式，补充秒数
        return time + ':00'
      } else if (timeParts.length === 3) {
        // HH:MM:SS 格式，直接返回
        return time
      } else {
        console.log('calculateWorkDuration: 时间格式不正确', time)
        return null
      }
    }
    
    const normalizedTime = normalizeTime(clockInTime)
    if (!normalizedTime) {
      return '0秒'
    }
    
    const timeParts = normalizedTime.split(':')
    const [hours, minutes, seconds] = timeParts.map(Number)
    
    // 验证时间格式
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      console.log('calculateWorkDuration: 时间数值无效', normalizedTime, hours, minutes, seconds)
      return '0秒'
    }
    
    const now = new Date()
    const clockIn = new Date()
    clockIn.setHours(hours, minutes, seconds, 0)
    
    // 如果上班时间是未来的时间，返回0秒
    if (clockIn > now) {
      console.log('calculateWorkDuration: 上班时间在未来', normalizedTime, '当前时间:', now.toLocaleTimeString())
      return '0秒'
    }
    
    const diffMs = now - clockIn
    const diffSeconds = Math.floor(diffMs / 1000)
    
    // 如果差值为负数，说明有问题
    if (diffSeconds < 0) {
      console.log('calculateWorkDuration: 计算出负数时间差', diffSeconds)
      return '0秒'
    }
    
    const workHours = Math.floor(diffSeconds / 3600)
    const remainingSeconds = diffSeconds % 3600
    const workMinutes = Math.floor(remainingSeconds / 60)
    const workSeconds = remainingSeconds % 60
    
    if (workHours > 0) {
      return workHours + '小时' + workMinutes + '分钟' + workSeconds + '秒'
    } else if (workMinutes > 0) {
      return workMinutes + '分钟' + workSeconds + '秒'
    } else {
      return workSeconds + '秒'
    }
  },

  // 计算并保存当天的工作时长
  calculateTodayWorkDuration() {
    const today = this.formatDate()
    const records = wx.getStorageSync('clockRecords') || []
    
    // 找到今天的上班和下班记录
    const clockInRecord = records.find(
      record => record.date === today && record.type === '上班'
    )
    const clockOutRecord = records.find(
      record => record.date === today && record.type === '下班'
    )
    
    if (clockInRecord && clockOutRecord && 
        clockInRecord.time && clockOutRecord.time) {
      
      // 标准化时间格式，支持 HH:MM 和 HH:MM:SS
      const normalizeTime = (time) => {
        const timeParts = time.split(':')
        if (timeParts.length === 2) {
          // HH:MM 格式，补充秒数
          return time + ':00'
        } else if (timeParts.length === 3) {
          // HH:MM:SS 格式，直接返回
          return time
        } else {
          console.log('calculateTodayWorkDuration: 时间格式不正确', time)
          return null
        }
      }
      
      const normalizedClockIn = normalizeTime(clockInRecord.time)
      const normalizedClockOut = normalizeTime(clockOutRecord.time)
      
      if (!normalizedClockIn || !normalizedClockOut) {
        return '0秒'
      }
      
      // 验证并解析上班时间
      const inTimeParts = normalizedClockIn.split(':')
      const outTimeParts = normalizedClockOut.split(':')
      
      const [hours, minutes, seconds] = inTimeParts.map(Number)
      const [outHours, outMinutes, outSeconds] = outTimeParts.map(Number)
      
      // 验证时间格式
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
          isNaN(outHours) || isNaN(outMinutes) || isNaN(outSeconds)) {
        console.log('calculateTodayWorkDuration: 时间数值无效', 
                   normalizedClockIn, normalizedClockOut,
                   hours, minutes, seconds, outHours, outMinutes, outSeconds)
        return '0秒'
      }
      
      const clockIn = new Date()
      clockIn.setHours(hours, minutes, seconds, 0)
      
      const clockOut = new Date()
      clockOut.setHours(outHours, outMinutes, outSeconds, 0)
      
      const diffMs = clockOut - clockIn
      const diffSeconds = Math.floor(diffMs / 1000)
      
      // 如果差值为负数，说明下班时间早于上班时间
      if (diffSeconds < 0) {
        console.log('calculateTodayWorkDuration: 下班时间早于上班时间', diffSeconds)
        return '0秒'
      }
      
      const workHours = Math.floor(diffSeconds / 3600)
      const remainingSeconds = diffSeconds % 3600
      const workMinutes = Math.floor(remainingSeconds / 60)
      const workSeconds = remainingSeconds % 60
      
      if (workHours > 0) {
        return workHours + '小时' + workMinutes + '分钟' + workSeconds + '秒'
      } else if (workMinutes > 0) {
        return workMinutes + '分钟' + workSeconds + '秒'
      } else {
        return workSeconds + '秒'
      }
    }
    return '0秒'
  },

  // 上班打卡
  clockIn() {
    if (this.hasRecordForToday('上班')) {
      wx.showToast({
        title: '今天已打过上班卡',
        icon: 'none'
      })
      return
    }
    
    const time = this.getCurrentTime()
    const newRecord = {
      date: this.formatDate(),
      type: '上班',
      time: time
    }
    
    // 保存记录
    const records = wx.getStorageSync('clockRecords') || []
    records.push(newRecord)
    wx.setStorageSync('clockRecords', records)
    
    // 更新状态
    this.setData({
      lastAction: '上班打卡成功',
      currentTime: time,
      clockedIn: true,
      clockedOut: false,
      clockInTime: time,
      workDuration: this.calculateWorkDuration(time)
    })
    
    wx.showToast({
      title: '上班打卡成功',
      icon: 'success'
    })
  },

  // 下班打卡
  clockOut() {
    const time = this.getCurrentTime()
    
    // 查找是否有今天的下班记录
    const today = this.formatDate()
    const records = wx.getStorageSync('clockRecords') || []
    const existingClockOutIndex = records.findIndex(
      record => record.date === today && record.type === '下班'
    )
    
    if (existingClockOutIndex !== -1) {
      // 更新现有的下班记录
      records[existingClockOutIndex].time = time
      wx.showToast({
        title: '更新下班打卡时间',
        icon: 'success'
      })
    } else {
      // 添加新的下班记录
      records.push({
        date: today,
        type: '下班',
        time: time
      })
      wx.showToast({
        title: '下班打卡成功',
        icon: 'success'
      })
    }
    
    // 保存记录
    wx.setStorageSync('clockRecords', records)
    
    // 计算并显示工作时长
    const workDuration = this.calculateTodayWorkDuration()
    
    // 更新状态
    this.setData({
      lastAction: existingClockOutIndex !== -1 ? '更新下班打卡成功' : '下班打卡成功',
      currentTime: time,
      clockedIn: false,
      clockInTime: null,
      clockedOut: true,
      workDuration: workDuration
    })
  },

  // 更新当前时间和工作时长
  updateCurrentTime() {
    const currentTime = this.getCurrentTime()
    const currentDate = this.getCurrentDate()
    
    let updateData = {
      currentTime: currentTime,
      currentDate: currentDate
    }
    
    // 如果已上班打卡，重新获取最新的上班时间来计算工作时长
    if (this.data.clockedIn) {
      const latestClockInTime = this.getTodayClockIn()
      console.log('updateCurrentTime: 重新获取的上班时间', latestClockInTime)
      
      // 如果获取到的最新时间和当前状态不一致，更新状态
      if (latestClockInTime !== this.data.clockInTime) {
        console.log('updateCurrentTime: 时间不一致，更新状态', latestClockInTime, this.data.clockInTime)
        updateData.clockInTime = latestClockInTime
        updateData.workDuration = this.calculateWorkDuration(latestClockInTime)
      } else {
        updateData.workDuration = this.calculateWorkDuration(this.data.clockInTime)
      }
    } else if (this.data.clockedOut) {
      // 已下班打卡，显示当天的工作时长
      updateData.workDuration = this.calculateTodayWorkDuration()
    } else {
      // 未上班打卡时显示0秒
      updateData.workDuration = '0秒'
    }
    
    this.setData(updateData)
  },

  // 检查今日打卡状态
  checkTodayStatus() {
    const clockInTime = this.getTodayClockIn()
    const hasClockedOut = this.hasRecordForToday('下班')
    
    if (clockInTime && !hasClockedOut) {
      // 已上班打卡，未下班打卡
      // 检查上班时间是否在未来，如果是则显示0秒
      const workDuration = this.calculateWorkDuration(clockInTime)
      
      // 如果计算结果是0秒，可能是时间格式问题或时间在未来
      if (workDuration === '0秒') {
        // 尝试验证时间是否在未来
        if (this.isClockInTimeInFuture(clockInTime)) {
          this.setData({
            clockedIn: true,
            clockInTime: clockInTime,
            clockedOut: false,
            showWorkDuration: true,
            workDuration: '0秒（上班时间未到）',
            lastAction: '今日已上班打卡'
          })
        } else {
          this.setData({
            clockedIn: true,
            clockInTime: clockInTime,
            clockedOut: false,
            showWorkDuration: true,
            workDuration: workDuration,
            lastAction: '今日已上班打卡'
          })
        }
      } else {
        this.setData({
          clockedIn: true,
          clockInTime: clockInTime,
          clockedOut: false,
          showWorkDuration: true,
          workDuration: workDuration,
          lastAction: '今日已上班打卡'
        })
      }
    } else if (hasClockedOut) {
      // 已下班打卡，显示计算的工作时长
      const workDuration = this.calculateTodayWorkDuration()
      this.setData({
        clockedIn: false,
        clockInTime: null,
        clockedOut: true,
        workDuration: workDuration,
        lastAction: '今日已完成打卡'
      })
    } else {
      // 尚未打卡
      this.setData({
        clockedIn: false,
        clockInTime: null,
        clockedOut: false,
        workDuration: '0秒',
        lastAction: '欢迎使用劳动时间记录'
      })
    }
  },

  // 检查上班时间是否在未来
  isClockInTimeInFuture(clockInTime) {
    if (!clockInTime || typeof clockInTime !== 'string') {
      return false
    }
    
    const timeParts = clockInTime.split(':')
    if (timeParts.length !== 3) {
      return false
    }
    
    const [hours, minutes, seconds] = timeParts.map(Number)
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return false
    }
    
    const now = new Date()
    const clockIn = new Date()
    clockIn.setHours(hours, minutes, seconds, 0)
    
    // 如果上班时间在今天但还未到，或者上班时间比当前时间晚
    return clockIn > now
  },

  onLoad() {
    // 检查今日打卡状态
    this.checkTodayStatus()
    
    // 启动定时器更新当前时间
    this.updateCurrentTime()
    this.timeInterval = setInterval(() => {
      this.updateCurrentTime()
    }, 1000)
  },

  onShow() {
    // 页面显示时重新检查状态
    console.log('onShow: 页面显示，重新检查状态')
    this.checkTodayStatus()
    this.updateCurrentTime()
  },

  onUnload() {
    // 清理定时器
    if (this.timeInterval) {
      clearInterval(this.timeInterval)
    }
  }
})