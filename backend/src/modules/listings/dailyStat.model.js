import mongoose from 'mongoose'

// One row per seller per day; feeds the "Ad performance" chart on the user dashboard
const dailyStatSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  views: { type: Number, default: 0 },
})

dailyStatSchema.index({ seller: 1, date: 1 }, { unique: true })

const DailyStat = mongoose.model('DailyStat', dailyStatSchema)

export default DailyStat
