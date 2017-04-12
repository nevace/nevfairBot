class MasterStrategyBase {
  constructor(username, stream, strategyName) {
    this.username = username;
    this.stream = stream;
    this.strategyName = strategyName;
  }

  /**
   * @param data
   * @abstract
   * @description Analyses data received from socket.
   */
  analyse(data) {

  }

}

module.exports = MasterStrategyBase;
