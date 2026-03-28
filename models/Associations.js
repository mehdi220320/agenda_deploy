const User = require("./User");
const Token = require("./Token");

User.hasOne(Token, {
    foreignKey: "userId",
    onDelete: "CASCADE",
});
Token.belongsTo(User, {
    foreignKey: "userId",
});