
// records.js - 支持多时段显示
Page({
  data: {
    groupedRecords: [], // 按日期分组的记录
    selectedMonth: '', // 选中的月份
    touchStartX: 0, // 触摸起始位置
    touchEndX: 0, // 触摸结束位置
    currentSwipeIndex: -1, // 当前滑动的项索引
    isSwiping: false, // 是否正在滑动
    touchStartTime: 0, // 触摸开始时间
    showClearButton: false // 是否显示清空数据按钮
  },

  // 统一的日期格式化方法 - 返回 YYYY/MM/DD 格式
  formatDate(date) {
    const d = date || new Date()
    const year = d.getFullYear()
    const month = d.getMonth() + 1
    const day = d.getDate()
    return year + '/' + (month < 10 ? '0' + month : month) + '/' + (day < 10 ? '0' + day : day)
  },

  // 格式化时长显示
  formatDuration(duration) {
    if (!duration) return '--'
    
    const [hours, minutes, seconds] = duration.split(':').map(Number)
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`
    } else {
      return `${seconds}秒`
    }
  },

  // 长按导入按钮 - 显示清空数据按钮
  onImportLongPress() {
    // 震动反馈
    wx.vibrateShort({
      success: () => {
        console.log('震动反馈成功')
      },
      fail: () => {
        console.log('震动反馈失败')
      }
    })
    
    // 显示清空数据按钮
    this.setData({
      showClearButton: true
    })
    
    // 3秒后自动隐藏清空按钮
    setTimeout(() => {
      this.setData({
        showClearButton: false
      })
    }, 3000)
  },

  // 清空所有数据
  clearAllData() {
    wx.showModal({
      title: '警告',
      content: '确定要清空所有打卡记录吗？此操作不可撤销！',
      confirmText: '确定清空',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清空存储的打卡记录
            wx.removeStorageSync('clockRecords')
            
            // 重新加载页面数据
            this.loadRecords()
            
            // 隐藏清空按钮
            this.setData({
              showClearButton: false
            })
            
            wx.showToast({
              title: '数据已清空',
              icon: 'success',
              duration: 2000
            })
          } catch (error) {
            console.error('清空数据失败:', error)
            wx.showToast({
              title: '清空失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  // 导出数据（CSV格式）
  exportData() {
    const records = wx.getStorageSync('clockRecords') || []
    if (records.length === 0) {
      wx.showToast({
        title: '暂无数据可导出',
        icon: 'none'
      })
      return
    }

    this.exportCSV(records)
  },

  // 导出CSV格式
  exportCSV(records) {
    try {
      // CSV表头
      const headers = [
        '日期', '星期', '时段类型', '上班时间', '下班时间', '工作时长', '当日总时长'
      ]
      
      // 转换数据格式
      const csvRows = []
      csvRows.push(headers.join(','))
      
      records.forEach(record => {
        if (!record.periods || !Array.isArray(record.periods)) {
          return
        }
        
        // 格式化日期和星期 - 包含完整的年月日信息
        const dateObj = new Date(record.date)
        const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        const weekDay = weekDays[dateObj.getDay()]
        
        // 为每个时段创建一行数据
        record.periods.forEach((period, index) => {
          const row = [
            `"${dateStr}"`, // 日期
            `"${weekDay}"`, // 星期
            `"${period.type === 'main' ? '主时段' : '加班时段'}"`, // 时段类型
            `"${this.formatTimeForDisplay(period.clockIn)}"`, // 上班时间
            `"${period.clockOut ? this.formatTimeForDisplay(period.clockOut) : ''}"`, // 下班时间
            `"${period.duration ? this.formatDurationForCSV(period.duration) : ''}"`, // 工作时长
            index === 0 ? `"${this.formatDurationForCSV(record.totalWorkTime)}"` : '""' // 只在第一行显示当日总时长
          ]
          csvRows.push(row.join(','))
        })
        
        // 如果某天没有时段，也要显示一行
        if (record.periods.length === 0) {
          const row = [
            `"${dateStr}"`,
            `"${weekDay}"`,
            `"无记录"`,
            `""`,
            `""`,
            `""`,
            `""`
          ]
          csvRows.push(row.join(','))
        }
      })
      
      // 生成CSV内容
      const csvContent = csvRows.join('\n')
      
      // 添加BOM以支持中文
      const BOM = '\uFEFF'
      const finalContent = BOM + csvContent
      
      wx.setClipboardData({
        data: finalContent,
        success: () => {
      wx.showModal({
        title: 'CSV导出成功',
        content: 'CSV数据已复制到剪贴板\n日期格式已包含年份（如：2024年12月9日）\n请粘贴到Excel、记事本或其他表格软件中\n建议保存为.csv文件',
        showCancel: false
      })
        }
      })
      
    } catch (error) {
      console.error('CSV导出失败:', error)
      wx.showToast({
        title: 'CSV导出失败',
        icon: 'error'
      })
    }
  },

  // 格式化时长用于CSV
  formatDurationForCSV(duration) {
    if (!duration) return ''
    
    const [hours, minutes, seconds] = duration.split(':').map(Number)
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`
    } else {
      return `${seconds}秒`
    }
  },

  // 导入数据（CSV格式）
  importData() {
    wx.showModal({
      title: '导入CSV数据',
      content: '请将CSV格式的打卡数据粘贴到剪贴板，然后点击确定\n注意：CSV格式应包含表头\n日期格式支持：2024年12月9日 或 12月9日',
      success: (res) => {
        if (res.confirm) {
          wx.getClipboardData({
            success: (clipRes) => {
              try {
                // 基础格式校验
                if (!clipRes.data || clipRes.data.trim() === '') {
                  throw new Error('剪贴板数据为空')
                }

                const records = this.parseCSVData(clipRes.data)
                
                if (records.length === 0) {
                  throw new Error('没有找到有效的打卡记录')
                }

                // 合并数据
                const currentRecords = wx.getStorageSync('clockRecords') || []
                const mergedRecords = this.mergeRecords(currentRecords, records)
                
                // 保存数据
                wx.setStorageSync('clockRecords', mergedRecords)
                this.loadRecords()

                wx.showModal({
                  title: 'CSV导入完成',
                  content: `成功导入${records.length}条记录`,
                  showCancel: false
                })
                
              } catch (error) {
                wx.showModal({
                  title: 'CSV导入失败',
                  content: error.message || 'CSV格式错误，请确保粘贴的是有效的CSV数据',
                  showCancel: false
                })
              }
            },
            fail: () => {
              wx.showToast({
                title: '无法读取剪贴板',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },

  // 解析CSV数据
  parseCSVData(csvData) {
    try {
      // 移除BOM
      csvData = csvData.replace(/^\uFEFF/, '')
      
      const lines = csvData.trim().split('\n')
      if (lines.length < 2) {
        throw new Error('CSV数据至少需要包含表头和一行数据')
      }

      // 解析表头
      const headers = this.parseCSVLine(lines[0])
      const requiredHeaders = ['日期', '星期', '时段类型', '上班时间', '下班时间']
      
      // 检查必要的表头是否存在
      for (const header of requiredHeaders) {
        if (!headers.includes(header)) {
          throw new Error(`缺少必要的表头: ${header}`)
        }
      }

      // 解析数据行
      const dateMap = new Map() // 用于合并同一天的数据
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        const values = this.parseCSVLine(line)
        if (values.length !== headers.length) {
          console.warn(`第${i + 1}行数据列数不匹配，跳过`)
          continue
        }

        const rowData = {}
        headers.forEach((header, index) => {
          rowData[header] = values[index] || ''
        })

        // 验证必要字段
        if (!rowData['日期'] || !rowData['上班时间']) {
          console.warn(`第${i + 1}行缺少必要数据，跳过`)
          continue
        }

        // 转换为程序内部格式
        const internalRecord = this.convertCSVRowToRecord(rowData)
        if (internalRecord) {
          const date = internalRecord.date
          if (dateMap.has(date)) {
            // 合并同一天的时段
            const existingRecord = dateMap.get(date)
            existingRecord.periods.push(...internalRecord.periods)
            // 重新计算总时长
            existingRecord.totalWorkTime = this.calculateTotalWorkTime(existingRecord.periods)
          } else {
            dateMap.set(date, internalRecord)
          }
        }
      }

      return Array.from(dateMap.values())
      
    } catch (error) {
      console.error('CSV解析失败:', error)
      throw error
    }
  },

  // 解析CSV行（处理引号和逗号）
  parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // 双引号转义
          current += '"'
          i++ // 跳过下一个引号
        } else {
          // 开始或结束引号
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // 字段分隔符
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // 添加最后一个字段
    result.push(current.trim())
    return result
  },

  // 将CSV行数据转换为内部记录格式
  convertCSVRowToRecord(rowData) {
    try {
      // 解析日期（格式：月日）
      const dateStr = rowData['日期']
      if (!dateStr) return null
      
      // 转换为YYYY/MM/DD格式，支持带年份和不带年份的格式
      let date
      
      if (dateStr.includes('年')) {
        // 带年份的格式：2024年12月9日
        const normalizedDate = dateStr.replace(/年|月/g, '/').replace(/日/, '')
        date = normalizedDate
      } else {
        // 不带年份的格式：12月9日，使用当前年份
        const currentYear = new Date().getFullYear()
        const monthDay = dateStr.replace(/月|日/g, match => match === '月' ? '/' : '')
        date = currentYear + '/' + monthDay
      }
      
      // 解析时段类型
      const periodTypeText = rowData['时段类型']
      if (!periodTypeText || periodTypeText === '无记录') {
        return null
      }
      
      const periodType = periodTypeText === '主时段' ? 'main' : 'overtime'
      
      // 解析时间
      const clockIn = rowData['上班时间']
      const clockOut = rowData['下班时间'] || null
      
      if (!clockIn) return null
      
      // 标准化时间格式
      const normalizedClockIn = this.normalizeTime(clockIn)
      const normalizedClockOut = clockOut ? this.normalizeTime(clockOut) : null
      
      // 计算时长
      const duration = normalizedClockOut ? this.calculatePeriodDuration(normalizedClockIn, normalizedClockOut) : null
      
      const period = {
        type: periodType,
        clockIn: normalizedClockIn,
        clockOut: normalizedClockOut,
        duration: duration
      }
      
      return {
        date: date,
        periods: [period],
        totalWorkTime: duration || null
      }
      
    } catch (error) {
      console.error('转换CSV行失败:', error)
      return null
    }
  },

  // 标准化时间格式
  normalizeTime(timeStr) {
    if (!timeStr) return ''
    
    // 移除可能的空格
    timeStr = timeStr.trim()
    
    // 处理 HH:MM 格式
    const timePattern = /^(\d{1,2}):(\d{2})$/
    const match = timeStr.match(timePattern)
    
    if (match) {
      const hours = match[1].padStart(2, '0')
      const minutes = match[2]
      return `${hours}:${minutes}:00`
    }
    
    return timeStr
  },

  // 计算单个时段时长
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

  // 计算多个时段总时长
  calculateTotalWorkTime(periods) {
    if (!periods || !Array.isArray(periods)) return null
    
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

  // 校验单条记录的格式
  validateRecord(record) {
    if (!record || typeof record !== 'object') {
      return false
    }

    // 必须有日期字段
    if (!record.date || typeof record.date !== 'string') {
      return false
    }

    // 日期格式校验（简单的YYYY/MM/DD或YYYY-MM-DD格式）
    const datePattern = /^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/
    if (!datePattern.test(record.date)) {
      return false
    }

    // 时间字段校验（如果存在）
    const timeFields = ['clockIn', 'clockOut']
    const timePattern = /^\d{1,2}:\d{2}(:\d{2})?$/
    
    for (const field of timeFields) {
      if (record[field] && !timePattern.test(record[field])) {
        return false
      }
    }

    return true
  },

  // 标准化记录格式
  normalizeRecord(record) {
    const normalized = { ...record }
    
    // 统一日期格式为 YYYY/MM/DD，并确保月份和日期都是两位数
    if (normalized.date && typeof normalized.date === 'string') {
      // 处理各种分隔符
      normalized.date = normalized.date.replace(/-/g, '/')
      
      // 分割日期部分并补零
      const dateParts = normalized.date.split('/')
      if (dateParts.length === 3) {
        const year = dateParts[0]
        const month = dateParts[1].padStart(2, '0')
        const day = dateParts[2].padStart(2, '0')
        normalized.date = `${year}/${month}/${day}`
      }
    }
    
    // 确保时间格式标准化
    const timeFields = ['clockIn', 'clockOut']
    timeFields.forEach(field => {
      if (normalized[field] && normalized[field].split(':').length === 2) {
        normalized[field] = normalized[field] + ':00'
      }
    })

    return normalized
  },

  // 合并记录（避免重复）
  mergeRecords(currentRecords, importedRecords) {
    const merged = [...currentRecords]
    const existingDates = new Set(currentRecords.map(r => r.date))
    
    importedRecords.forEach(record => {
      if (!existingDates.has(record.date)) {
        merged.push(record)
      }
    })
    
    // 按日期排序
    merged.sort((a, b) => new Date(a.date) - new Date(b.date))
    return merged
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

  // 迁移历史数据，确保所有日期格式统一和时间都包含秒数
  migrateOldData() {
    try {
      const records = wx.getStorageSync('clockRecords') || []
      let hasChanges = false
      
      const migratedRecords = records.map(record => {
        let updatedRecord = { ...record }
        let recordChanged = false
        
        // 处理日期格式标准化
        if (updatedRecord.date && typeof updatedRecord.date === 'string') {
          // 处理各种分隔符
          let normalizedDate = updatedRecord.date.replace(/-/g, '/')
          
          // 分割日期部分并补零
          const dateParts = normalizedDate.split('/')
          if (dateParts.length === 3) {
            const year = dateParts[0]
            const month = dateParts[1].padStart(2, '0')
            const day = dateParts[2].padStart(2, '0')
            normalizedDate = `${year}/${month}/${day}`
            
            if (normalizedDate !== updatedRecord.date) {
              updatedRecord.date = normalizedDate
              recordChanged = true
            }
          }
        }
        
        // 处理时间格式标准化
        if (updatedRecord.time && typeof updatedRecord.time === 'string') {
          const timeParts = updatedRecord.time.split(':')
          if (timeParts.length === 2) {
            // HH:MM 格式，补充秒数
            updatedRecord.time = updatedRecord.time + ':00'
            recordChanged = true
          }
        }
        
        if (recordChanged) {
          hasChanges = true
          return updatedRecord
        }
        return record
      })
      
      if (hasChanges) {
        wx.setStorageSync('clockRecords', migratedRecords)
        console.log('历史数据迁移完成，统一了日期格式并补充了秒数格式')
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
    
    // 为每个日期获取对应的多时段记录
    const allDateRecords = dateRange.map(date => {
      const dayRecord = records.find(record => record.date === date)
      
      if (dayRecord && dayRecord.periods) {
        // 新格式多时段数据
        const formattedPeriods = dayRecord.periods.map(period => ({
          type: period.type,
          clockIn: this.formatTimeForDisplay(period.clockIn),
          clockOut: period.clockOut ? this.formatTimeForDisplay(period.clockOut) : null,
          duration: period.duration ? this.formatDuration(period.duration) : null
        }))
        
        // 处理时段折叠显示：3个及以下显示全部，4个及以上显示前2条+统计
        let displayPeriods, hasMorePeriods, moreMainCount, moreOvertimeCount
        
        if (formattedPeriods.length <= 3) {
          // 3个及以下显示全部时段
          displayPeriods = formattedPeriods
          hasMorePeriods = false
          moreMainCount = 0
          moreOvertimeCount = 0
        } else {
          // 4个及以上显示前2条+统计
          displayPeriods = formattedPeriods.slice(0, 2)
          hasMorePeriods = true
          
          // 计算剩余的主时段和加班时段数量（从第3个开始）
          moreMainCount = 0
          moreOvertimeCount = 0
          const remainingPeriods = formattedPeriods.slice(2)
          remainingPeriods.forEach(period => {
            if (period.type === 'main') {
              moreMainCount++
            } else if (period.type === 'overtime') {
              moreOvertimeCount++
            }
          })
        }
        
        return {
          date: date,
          dateStr: this.formatDateStr(date),
          weekDay: this.getWeekDay(date),
          periods: formattedPeriods,
          displayPeriods: displayPeriods,
          hasMorePeriods: hasMorePeriods,
          moreMainCount: moreMainCount,
          moreOvertimeCount: moreOvertimeCount,
          totalDuration: dayRecord.totalWorkTime ? this.formatDuration(dayRecord.totalWorkTime) : null,
          slideOffset: 0
        }
      } else {
        // 兼容旧格式数据或空记录
        return {
          date: date,
          dateStr: this.formatDateStr(date),
          weekDay: this.getWeekDay(date),
          periods: [],
          displayPeriods: [],
          hasMorePeriods: false,
          moreCount: 0,
          totalDuration: null,
          slideOffset: 0
        }
      }
    })
    
    this.setData({ groupedRecords: allDateRecords })
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
      
      // 过滤掉指定日期的记录（需要比较标准化后的日期）
      const filteredRecords = records.filter(record => {
        const normalizedRecord = this.normalizeRecord(record)
        return normalizedRecord.date !== date
      })
      
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
  },

  // 分享给好友
  onShareAppMessage() {
    const recordCount = this.data.groupedRecords.length
    return {
      title: `我的打卡记录 - 共${recordCount}条记录`,
      path: '/pages/records/records',
      imageUrl: '' // 可以设置分享图片，留空使用默认截图
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '我的打卡记录 - 使用劳动时间记录小程序',
      imageUrl: '' // 可以设置分享图片，留空使用默认截图
    }
  }
})