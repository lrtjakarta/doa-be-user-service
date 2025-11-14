const mongoose = require("mongoose");
//Define a schema
const Schema = mongoose.Schema;

const pageSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  type: String, // module, sub module
  index: Number, // nomor urut
  link: String,
  pathIcon: String,
  icon: String,
  level: {
    type: Number,
    default: 1,
  },
  parent: {
    type: Schema.Types.ObjectId,
    default: null,
  },
});

pageSchema.pre("save", function (next) {
  if (!this.parent) {
    this.parent = null;
  }

  next();
});

module.exports = mongoose.model("pages", pageSchema);
