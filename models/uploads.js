const { DataTypes } = require('sequelize');
module.exports = (sequelize) => sequelize.define('Upload', {
    code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    author: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: "uploads"
});