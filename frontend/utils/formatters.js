// frontend/utils/formatters.js
const Formatters = {
    number(num, decimals = 2) {
        if (!num) return '0';
        const parts = num.toString().split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        if (!decimals) return parts[0];
        return parts.join('.').substring(0, parts[0].length + decimals + 1);
    },

    address(addr) {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    },

    percentage(num) {
        return (num || 0).toFixed(2) + '%';
    },

    date(timestamp) {
        return new Date(timestamp).toLocaleDateString();
    },

    time(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
    },

    currency(num, currency = '$') {
        return `${currency}${this.number(num, 2)}`;
    },

    bytes32(hash) {
        if (!hash) return '';
        return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
    }
};