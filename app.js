// app.js
App({
  onLaunch() {
    this.checkAndBackupData()
    this.migrateToMultiPeriodFormat()
  },

  // 检查并备份数据
  checkAndBackupData() {
    const records = wx.getStorageSync('clockRecords') || []
    
    if (records.length === 0) {
      // 如果没有数据，尝试从备份恢复
      const backupRecords = wx.getStorageSync('clockRecords_backup')
      if (backupRecords && backupRecords.length > 0) {
        wx.setStorageSync('clockRecords', backupRecords)
        console.log('从备份恢复数据成功')
      }
    } else {
      // 如果有数据，创建备份
      wx.setStorageSync('clockRecords_backup', records)
      console.log('数据备份成功')
    }
  },

  // 迁移到多时段格式
  migrateToMultiPeriodFormat() {
    try {
      const records = wx.getStorageSync('clockRecords') || []
      const migrationFlag = wx.getStorageSync('multiPeriodMigrated')
      
      // 如果已经迁移过，跳过
      if (migrationFlag) {
        console.log('数据已迁移，跳过迁移流程')
        return
      }

      if (records.length === 0) {
        // 没有数据，标记为已迁移
        wx.setStorageSync('multiPeriodMigrated', true)
        return
      }

      const migratedRecords = []
      const dateMap = new Map()

      // 按日期分组旧数据
      records.forEach(record => {
        const date = record.date
        if (!dateMap.has(date)) {
          dateMap.set(date, [])
        }
        dateMap.get(date).push(record)
      })

      // 转换为新格式
      dateMap.forEach((dayRecords, date) => {
        const clockIn = dayRecords.find(r => r.type === '上班')
        const clockOut = dayRecords.find(r => r.type === '下班')

        if (clockIn && clockOut) {
          // 有完整的上下班记录
          migratedRecords.push({
            date: date,
            periods: [{
              type: 'main',
              clockIn: clockIn.time,
              clockOut: clockOut.time,
              duration: this.calculateDuration(clockIn.time, clockOut.time)
            }],
            totalWorkTime: this.calculateDuration(clockIn.time, clockOut.time)
          })
        } else if (clockIn) {
          // 只有上班记录
          migratedRecords.push({
            date: date,
            periods: [{
              type: 'main',
              clockIn: clockIn.time,
              clockOut: null,
              duration: null
            }],
            totalWorkTime: null
          })
        }
      })

      // 保存迁移后的数据
      wx.setStorageSync('clockRecords', migratedRecords)
      wx.setStorageSync('multiPeriodMigrated', true)
      console.log('数据迁移完成，共迁移', migratedRecords.length, '条记录')

    } catch (error) {
      console.error('数据迁移失败:', error)
    }
  },

  // 计算时间差
  calculateDuration(startTime, endTime) {
    if (!startTime || !endTime) return null
    
    const start = new Date('2024/01/01 ' + startTime)
    const end = new Date('2024/01/01 ' + endTime)
    
    let diffMs = end - start
    if (diffMs < 0) {
      // 跨天情况
      diffMs += 24 * 60 * 60 * 1000
    }
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
})
