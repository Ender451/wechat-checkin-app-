
// stats.js
Page({
  data: {
    records: [],
    stats: {
      totalDays: 0,
      avgWorkTime: '0小时0分钟',
      earliestClockIn: '--',
      latestClockOut: '--'
    },
    chartData: null,
    selectedMonth: '',
    isRecent30Days: true,
    chartTitle: '近30天上下班时间趋势',
    displayMonthText: '最近30天'
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

  onLoad() {
    this.initializeSelectedMonth()
    this.loadRecords()
  },

  // 初始化选中的月份
  initializeSelectedMonth() {
    // 默认显示最近30天
    this.setData({
      selectedMonth: '',
      isRecent30Days: true,
      chartTitle: '近30天上下班时间趋势',
      displayMonthText: '最近30天'
    })
  },

  // 月份选择变化
  onMonthChange(e) {
    const selectedValue = e.detail.value
    const [year, month] = selectedValue.split('-')
    this.setData({
      selectedMonth: selectedValue,
      isRecent30Days: false,
      chartTitle: selectedValue + '月上下班时间趋势',
      displayMonthText: selectedValue
    })
    this.loadRecords()
  },

  // 重置到最近30天
  resetToRecentDays() {
    this.setData({
      selectedMonth: '',
      isRecent30Days: true,
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
    this.setData({ records })
    this.calculateStats(records)
    this.processChartData(records)
    
    // 延迟绘制图表，确保DOM渲染完成
    setTimeout(() => {
      this.drawChart()
    }, 500)
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
          earliestClockIn: '--',
          latestClockOut: '--'
        }
      })
      return
    }

    // 按日期分组
    var grouped = {}
    for (var i = 0; i < records.length; i++) {
      var record = records[i]
      if (!grouped[record.date]) {
        grouped[record.date] = {}
      }
      grouped[record.date][record.type] = record.time
    }

    var validDays = []
    var clockInTimes = []
    var clockOutTimes = []

    // 获取有效日期
    for (var date in grouped) {
      var day = grouped[date]
      if (day['上班'] && day['下班']) {
        validDays.push(date)
        clockInTimes.push(day['上班'])
        clockOutTimes.push(day['下班'])
      }
    }

    // 计算平均工作时长
    var totalMinutes = 0
    for (var j = 0; j < validDays.length; j++) {
      var currentDate = validDays[j]
      var start = grouped[currentDate]['上班']
      var end = grouped[currentDate]['下班']
      
      // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
      var normalizeTime = function(time) {
        var timeParts = time.split(':')
        if (timeParts.length === 2) {
          return time + ':00'  // HH:MM -> HH:MM:00
        } else if (timeParts.length === 3) {
          return time          // HH:MM:SS 保持不变
        } else {
          return time          // 格式异常，保持原样
        }
      }
      
      var normalizedStart = normalizeTime(start)
      var normalizedEnd = normalizeTime(end)
      
      var startParts = normalizedStart.split(':')
      var endParts = normalizedEnd.split(':')
      var startHour = parseInt(startParts[0])
      var startMinute = parseInt(startParts[1])
      var startSecond = parseInt(startParts[2])
      var endHour = parseInt(endParts[0])
      var endMinute = parseInt(endParts[1])
      var endSecond = parseInt(endParts[2])
      
      // 转换为总分钟数，考虑秒数
      var startTotalMinutes = startHour * 60 + startMinute + startSecond / 60
      var endTotalMinutes = endHour * 60 + endMinute + endSecond / 60
      var minutes = endTotalMinutes - startTotalMinutes
      if (minutes > 0) totalMinutes += minutes
    }

    var avgMinutes = validDays.length > 0 ? Math.round(totalMinutes / validDays.length) : 0
    var avgHours = Math.floor(avgMinutes / 60)
    var avgMins = avgMinutes % 60

    // 找出最早上班时间和最晚下班时间
    var earliestClockIn = '--'
    var latestClockOut = '--'
    
    if (clockInTimes.length > 0) {
      earliestClockIn = clockInTimes[0]
      for (var k = 1; k < clockInTimes.length; k++) {
        if (clockInTimes[k] < earliestClockIn) {
          earliestClockIn = clockInTimes[k]
        }
      }
    }
    
    if (clockOutTimes.length > 0) {
      latestClockOut = clockOutTimes[0]
      for (var m = 1; m < clockOutTimes.length; m++) {
        if (clockOutTimes[m] > latestClockOut) {
          latestClockOut = clockOutTimes[m]
        }
      }
    }

    // 格式化显示时间，只显示小时和分钟
    var displayEarliestClockIn = earliestClockIn === '--' ? '--' : this.formatTimeForDisplay(earliestClockIn)
    var displayLatestClockOut = latestClockOut === '--' ? '--' : this.formatTimeForDisplay(latestClockOut)

    this.setData({
      stats: {
        totalDays: validDays.length,
        avgWorkTime: avgHours + '小时' + avgMins + '分钟',
        earliestClockIn: displayEarliestClockIn,
        latestClockOut: displayLatestClockOut
      }
    })
  },

  // 处理图表数据
  processChartData(records) {
    // 按日期分组
    var grouped = {}
    for (var i = 0; i < records.length; i++) {
      var record = records[i]
      if (!grouped[record.date]) {
        grouped[record.date] = {}
      }
      grouped[record.date][record.type] = record.time
    }

    var dates = []
    var clockInData = []
    var clockOutData = []
    var workHoursData = []

    // 判断是否按月份筛选还是最近30天
    if (this.data.isRecent30Days) {
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
        var dayData = grouped[fullDateStr]
        
        // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
        var normalizeTime = function(time) {
          var timeParts = time.split(':')
          if (timeParts.length === 2) {
            return time + ':00'  // HH:MM -> HH:MM:00
          } else if (timeParts.length === 3) {
            return time          // HH:MM:SS 保持不变
          } else {
            return time          // 格式异常，保持原样
          }
        }

        if (dayData && dayData['上班']) {
          var normalizedClockIn = normalizeTime(dayData['上班'])
          var timeParts = normalizedClockIn.split(':')
          var hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600
          clockInData.push(hours)
        } else {
          clockInData.push(null)
        }

        if (dayData && dayData['下班']) {
          var normalizedClockOut = normalizeTime(dayData['下班'])
          var timeParts2 = normalizedClockOut.split(':')
          var hours2 = parseInt(timeParts2[0]) + parseInt(timeParts2[1]) / 60 + parseInt(timeParts2[2]) / 3600
          clockOutData.push(hours2)
        } else {
          clockOutData.push(null)
        }

        // 计算工作时长
        if (dayData && dayData['上班'] && dayData['下班']) {
          var normalizedStart = normalizeTime(dayData['上班'])
          var normalizedEnd = normalizeTime(dayData['下班'])
          var startParts = normalizedStart.split(':')
          var endParts = normalizedEnd.split(':')
          var startHour = parseInt(startParts[0])
          var startMinute = parseInt(startParts[1])
          var startSecond = parseInt(startParts[2])
          var endHour = parseInt(endParts[0])
          var endMinute = parseInt(endParts[1])
          var endSecond = parseInt(endParts[2])
          
          // 转换为总秒数进行精确计算
          var startTotalSeconds = startHour * 3600 + startMinute * 60 + startSecond
          var endTotalSeconds = endHour * 3600 + endMinute * 60 + endSecond
          var workSeconds = endTotalSeconds - startTotalSeconds
          
          if (workSeconds > 0) {
            workHoursData.push(workSeconds / 3600) // 转换为小时
          } else {
            workHoursData.push(null)
          }
        } else {
          workHoursData.push(null)
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
        var dayData = grouped[fullDateStr]
        
        // 格式化日期为 MM-DD
        var day = currentDay.getDate()
        var dateStr = (parseInt(month) < 10 ? '0' + parseInt(month) : month) + '-' + (day < 10 ? '0' + day : day)
        dates.push(dateStr)
        
        // 标准化时间格式，兼容 HH:MM 和 HH:MM:SS
        var normalizeTime = function(time) {
          var timeParts = time.split(':')
          if (timeParts.length === 2) {
            return time + ':00'  // HH:MM -> HH:MM:00
          } else if (timeParts.length === 3) {
            return time          // HH:MM:SS 保持不变
          } else {
            return time          // 格式异常，保持原样
          }
        }

        if (dayData && dayData['上班']) {
          var normalizedClockIn = normalizeTime(dayData['上班'])
          var timeParts = normalizedClockIn.split(':')
          var hours = parseInt(timeParts[0]) + parseInt(timeParts[1]) / 60 + parseInt(timeParts[2]) / 3600
          clockInData.push(hours)
        } else {
          clockInData.push(null)
        }

        if (dayData && dayData['下班']) {
          var normalizedClockOut = normalizeTime(dayData['下班'])
          var timeParts2 = normalizedClockOut.split(':')
          var hours2 = parseInt(timeParts2[0]) + parseInt(timeParts2[1]) / 60 + parseInt(timeParts2[2]) / 3600
          clockOutData.push(hours2)
        } else {
          clockOutData.push(null)
        }

        // 计算工作时长
        if (dayData && dayData['上班'] && dayData['下班']) {
          var normalizedStart = normalizeTime(dayData['上班'])
          var normalizedEnd = normalizeTime(dayData['下班'])
          var startParts = normalizedStart.split(':')
          var endParts = normalizedEnd.split(':')
          var startHour = parseInt(startParts[0])
          var startMinute = parseInt(startParts[1])
          var startSecond = parseInt(startParts[2])
          var endHour = parseInt(endParts[0])
          var endMinute = parseInt(endParts[1])
          var endSecond = parseInt(endParts[2])
          
          // 转换为总秒数进行精确计算
          var startTotalSeconds = startHour * 3600 + startMinute * 60 + startSecond
          var endTotalSeconds = endHour * 3600 + endMinute * 60 + endSecond
          var workSeconds = endTotalSeconds - startTotalSeconds
          
          if (workSeconds > 0) {
            workHoursData.push(workSeconds / 3600) // 转换为小时
          } else {
            workHoursData.push(null)
          }
        } else {
          workHoursData.push(null)
        }
        
        currentDay.setDate(currentDay.getDate() + 1)
      }
    }

    this.setData({
      chartData: {
        dates: dates,
        clockInData: clockInData,
        clockOutData: clockOutData,
        workHoursData: workHoursData
      }
    })
  },

  // 绘制折线图和柱状图
  drawChart() {
    if (!this.data.chartData) return

    try {
      var ctx = wx.createCanvasContext('timeChart')
      var chartData = this.data.chartData
      var canvasWidth = 340 // 增加宽度以容纳右侧刻度
      var canvasHeight = 300 // 增加高度以容纳柱状图
      var padding = 30 // 减少边距，增加图表显示区域
      var rightPadding = 40 // 右侧额外空间给刻度标签
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
      ctx.moveTo(canvasWidth - rightPadding, padding)
      ctx.lineTo(canvasWidth - rightPadding, canvasHeight - padding)
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
          ctx.lineTo(canvasWidth - rightPadding, y)
          ctx.stroke()
        }
      }

      // 计算工作时长数据的自适应刻度范围
      var workHoursData = chartData.workHoursData.filter(h => h !== null)
      var maxWorkHours = Math.max(...workHoursData, 10)
      var minWorkHours = Math.min(...workHoursData, 0)
      var avgWorkHours = workHoursData.length > 0 
        ? workHoursData.reduce((a, b) => a + b, 0) / workHoursData.length 
        : 8
      
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
        ctx.fillText(h + 'h', canvasWidth - rightPadding + 5, y + 3) // 使用新的右边距
      }

      // 绘制X轴刻度（日期）
      ctx.setFillStyle('#666666')
      ctx.setFontSize(9)
      var step = Math.ceil(chartData.dates.length / 8) // 最多显示8个标签
      for (var j = 0; j < chartData.dates.length; j += step) {
        var x = padding + (j / (chartData.dates.length - 1)) * chartWidth
        ctx.save()
        ctx.translate(x, canvasHeight - padding + 15)
        ctx.rotate(-Math.PI / 4) // 旋转45度避免重叠
        ctx.fillText(chartData.dates[j], 0, 0)
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
  }
})