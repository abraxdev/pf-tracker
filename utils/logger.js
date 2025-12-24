// app/utils/logger.js
// Utility per logging strutturato

class Logger {
  constructor(verbose = true) {
    this.verbose = verbose;
  }

  info(message, ...args) {
    if (this.verbose) {
      console.log(`ℹ️  ${message}`, ...args);
    }
  }

  success(message, ...args) {
    if (this.verbose) {
      console.log(`✅ ${message}`, ...args);
    }
  }

  warning(message, ...args) {
    if (this.verbose) {
      console.log(`⚠️  ${message}`, ...args);
    }
  }

  error(message, ...args) {
    if (this.verbose) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  progress(current, total, message) {
    if (this.verbose) {
      console.log(`[${current}/${total}] ${message}`);
    }
  }

  separator(char = '═', length = 60) {
    if (this.verbose) {
      console.log(char.repeat(length));
    }
  }

  header(title) {
    if (this.verbose) {
      console.log('\n' + title);
      this.separator();
    }
  }
}

module.exports = Logger;
