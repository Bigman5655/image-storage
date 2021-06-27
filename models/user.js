const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    iv: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isAdmin: {
        type: DataTypes.TINYINT(1),
        defaultValue: 0
    }
}, {
    tableName: "users"
});