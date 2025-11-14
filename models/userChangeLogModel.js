const mongoose = require("mongoose")
const Schema = mongoose.Schema
const userChangeLogSchema = new Schema(
    {
        userId: String,
        changeType: String,
        changeNote: String,
        beforeData: Object,
        afterData: Object
    },
    {
        timestamps: true
    }
)
module.exports = mongoose.model("userChangeLogs", userChangeLogSchema)
