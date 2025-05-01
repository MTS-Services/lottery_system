const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);


// Generates a unique, random code (e.g., for invitations)
const generateUniqueCode = (length = 8) => {
    // Generate random bytes, convert to hex, and take the first 'length' characters
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length).toUpperCase();
};

// Hashes a plain text password using bcrypt
const hashPassword = async (password) => {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    return await bcrypt.hash(password, saltRounds);
};

// Compares a plain text password with a hashed password
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Helper to calculate the NEXT PAYMENT DUE DATE based on a start date and frequency
// This is used for the *current* cycle's due date calculation (upon activation)
// and the next cycle's due date after lottery execution.
const calculateNextDueDate = (startDate, frequency) => {
    // Ensure input date is treated consistently, e.g., as UTC
    const start = dayjs(startDate).utc();
    let nextDate;
    switch (frequency) {
        case 'WEEKLY':
            nextDate = start.add(7, 'day');
            break;
        case 'BI_WEEKLY': // Assuming BI_WEEKLY enum value in Prisma
            nextDate = start.add(14, 'day');
            break;
        case 'MONTHLY':
            nextDate = start.add(1, 'month');
            break;
        default:
            // Should not happen if frequency is validated based on Enum
            throw new Error('Invalid frequency provided for calculation');
    }
    return nextDate.toDate(); // Return as standard Date object
};

// Helper to calculate the ACTUAL START DATE OF THE NEXT CYCLE
// This is used in executeScheduledLottery to determine when the new cycle officially begins
// based on the date the *previous* cycle's lottery was drawn.
const calculateNextCycleStartDate = (lotteryDate) => {
    // Ensure input date is treated consistently, e.g., as UTC
    const drawDate = dayjs(lotteryDate).utc();
    // Example: Set the next cycle start to the beginning of the day after the lottery date
    return drawDate.add(1, 'day').startOf('day').toDate();
    // Alternative logic could be needed based on exact business rules
};

// Helper to calculate the EXPECTED START DATE OF THE NEXT CYCLE
// based on the CURRENT cycle's start date and frequency.
// This is primarily used for advance payment cycle identification reference.
const calculateNextCycleStartDateBasedOnFrequency = (currentCycleStartDate, frequency) => {
     // Ensure input date is treated consistently, e.g., as UTC
     const start = dayjs(currentCycleStartDate).utc();
     let nextStartDate;
     switch (frequency) {
        case 'WEEKLY':
            nextStartDate = start.add(7, 'day');
            break;
        case 'BI_WEEKLY': // Assuming BI_WEEKLY enum value
            nextStartDate = start.add(14, 'day');
            break;
        case 'MONTHLY':
            nextStartDate = start.add(1, 'month');
            break;
        default:
            // Should not happen if frequency is validated
            throw new Error('Invalid frequency provided for calculation');
     }
     // Set to start of day for consistent identifier
     return nextStartDate.startOf('day').toDate(); // Return as Date object
};


// Simple function to format date for cycle identifier and display
// Use dayjs for consistent formatting and UTC
const formatDateForCycle = (date) => {
    if (!date) return 'N/A'; // Handle null or undefined dates
    return dayjs(date).utc().format('YYYY-MM-DD'); // Format as YYYY-MM-DD UTC
};


module.exports = {
    generateUniqueCode,
    hashPassword,
    comparePassword,
    calculateNextDueDate, // Calculates the next *due date* from a start date
    calculateNextCycleStartDate, // Calculates the *next cycle start date* from lottery date
    calculateNextCycleStartDateBasedOnFrequency, // Calculates *expected* next cycle start from current start + frequency
    formatDateForCycle,
};