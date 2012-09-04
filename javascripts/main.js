/**
 * Angular Controller for the calculator
 */
function GlacierCalculatorCtrl($scope) {
  // Multiplier for each unit value (default is GB)
  $scope.units = [
    {name:'GB', value:'1'},
    {name:'TB', value:'1024'},
    {name:'PB', value:'1048576'}
  ];
  
  // Default units
  $scope.storedDataUnits = $scope.units[0].value;   // Default: GB
  $scope.retrieveDataUnits = $scope.units[0].value; // Default: GB
  $scope.deletedDataUnits = $scope.units[0].value;  // Default: GB
  
  // Default values for the showMore disclosure pane
  $scope.showMore= {
       "RETRIEVAL": 0.0,
       "ASSUMPTIONS": 0.0
  };
    
  $scope.calculate = function() {
    // Apply unit multiplier to user submitted value to homogenize input as GB
    $scope.storedData = ( $scope.storedDataInput * $scope.storedDataUnits )
    $scope.deletedData = ( $scope.deletedDataInput * $scope.deletedDataUnits )
    $scope.retrieveData = ( $scope.retrieveDataInput * $scope.retrieveDataUnits )
    
    // Perform calculations, get results
    $scope.rateAllowance = glacierCalculator.rateAllowance($scope);
    $scope.dailyAllowance = glacierCalculator.dailyAllowance($scope);
    $scope.monthlyAllowance = glacierCalculator.monthlyAllowance($scope);
    $scope.storageCost = glacierCalculator.storageCost($scope);
    $scope.retrievalCost = glacierCalculator.retrievalCost($scope);
    $scope.deletionCost = glacierCalculator.deletionCost($scope);
    $scope.transferCost = glacierCalculator.transferCost($scope);
    $scope.totalCost = $scope.storageCost +
      $scope.retrievalCost +
      $scope.transferCost +
      $scope.deletionCost;
  };
}


/**
 * Glacier calculator
 */
var glacierCalculator = (function() {

  /**
   * We assume it takes 4 hours for Amazon to fulfill our request
   *
   * Per Colin@AWS's statement here: https://forums.aws.amazon.com/thread.jspa?threadID=102485&tstart=0
   */
  var retrieveJobHours = 4;

  
  /**
   * Converts GB into whichever unit fits best for human consumption
   *
   * @private
   * @param {Float} gigabytes - a size value in GB
   * @return {String}
   */
  var humanSize = function(gigabytes) {
    var quant = {
      PB: 1048576,
      TB: 1024,
      GB: 1,
      MB: 1/1024,
      KB: 1/1048576
    };
    for (var i in quant) {
      var unit = i;
      var value = quant[i];
      if (gigabytes >= value) {
          return (gigabytes / value).toFixed(2) + ' ' + unit;
      }
    }
  };
  

  /**
   * Returns the storage rate for the region
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  function regionStorageRate(scope) {
    switch (scope.region) {
    case 'us-east': return 0.01;
    case 'us-west-1': return 0.01;
    case 'us-west-2': return 0.011;
    case 'europe': return 0.011;
    case 'asia': return 0.012;
    default: return 0.01;
    }
  }


  /**
   * Returns the transfer rate for the region
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @param {String} tier - The tiers available
   * @return {Float}
   */
  function regionTransferRate(scope, tier) {
    if (scope.region === 'asia') {
      switch (tier) {
      case '10tb': return 0.201;
      case '40tb': return 0.158;
      case '100tb': return 0.137;
      case '350tb': return 0.127;
      case 'max': return 0.127;
      default: return 0.201;
      }
    } else {
      switch (tier) {
      case '10tb': return 0.12;
      case '40tb': return 0.09;
      case '100tb': return 0.07;
      case '350tb': return 0.05;
      case 'max': return 0.05;
      default: return 0.12;
      }
    }
  }


  /**
   * Returns the deletion rate for the region
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  function regionDeletionRate(scope) {
    switch (scope.region) {
    case 'us-east': return 0.01;
    case 'us-west-1': return 0.01;
    case 'us-west-2': return 0.011;
    case 'europe': return 0.011;
    case 'asia': return 0.012;
    default: return 0.01;
    }
  }


  /**
   * Returns the retrieval rate for the region
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  function regionRetrievalRate(scope) {
    switch (scope.region) {
    case 'us-east': return 0.01;
    case 'us-west-1': return 0.01;
    case 'us-west-2': return 0.011;
    case 'europe': return 0.011;
    case 'asia': return 0.012;
    default: return 0.01;
    }
  }


  /**
   * Returns the peak hourly retrieval rate in GB
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  function peakHourlyRetrieval(scope) {
    if (typeof scope.retrieveData != 'undefined') {
      return scope.retrieveData / retrieveJobHours;
    } else {
      return 0;
    }
  }


  /**
   * Returns the free hourly retrieval rate in GB
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  function freeHourlyRetrieval(scope) {
    if (typeof scope.storedData != 'undefined') {
      return (scope.storedData * 0.05) / (30 * retrieveJobHours);
    } else {
      return 0;
    }
  }


  /**
   * Returns the total transfer rate for the tier
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @param {Integer} data - The amount of data to transfer in GB
   * @param {String} tier - The tier
   * @return {Integer}
   */
  function rateForTier(scope, data, tier) {
    return regionTransferRate(scope, tier) * data;
  }


  /**
   * Returns the total data for the tier
   *
   * @private
   * @param {Integer} data - The amount of data to transfer in GB
   * @param {String} tierLimit - The tier limit
   * @return {Integer}
   */
  function dataForTier(data, tierLimit) {
    if (data > tierLimit) {
      return tierLimit;
    } else {
      return data;
    }
  }



  var estimate = {};

  /**
   * Returns the monthly free retrieval allowance, prorated to the day in GB
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
   estimate.dailyAllowance = function(scope) {
    if (typeof scope.storedData != 'undefined') {
      return humanSize((scope.storedData * 0.05) / 30);
    } else {
      return 0;
    }
  }


  /**
   * Returns the monthly free retrieval allowance in GB
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.monthlyAllowance = function(scope) {
    if (typeof scope.storedData != 'undefined') {
      return humanSize(scope.storedData * 0.05);
    } else {
      return 0;
    }
  }


  /**
   * Returns the free hourly retrieval rate in GB/hour
   *
   * @private
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.rateAllowance = function(scope) {
    if (typeof scope.storedData != 'undefined') {
      return humanSize(freeHourlyRetrieval(scope));
    } else {
      return 0
    }
  }


  /**
   * Calculates the storage cost based on the region.
   *
   * @public
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.storageCost = function(scope) {
    if (typeof scope.storedData != 'undefined' && typeof scope.storedDuration != 'undefined') {
      var durationInMonth = scope.storedDuration / 30;
      return regionStorageRate(scope) * scope.storedData * durationInMonth;
    } else {
      return 0;
    }
  };


  /**
   * Calculates the retrieval cost based on the region
   *
   * @public
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.retrievalCost = function(scope) {
    if (typeof scope.retrieveData != 'undefined') {
      console.log(peakHourlyRetrieval(scope));
      console.log(freeHourlyRetrieval(scope));
      var peakHourRetrievalData = peakHourlyRetrieval(scope) - freeHourlyRetrieval(scope);
      if (peakHourRetrievalData > 0) {
	return regionRetrievalRate(scope) * peakHourRetrievalData * 720;
      } else {
	return 0;
      }
    } else {
      return 0;
    }
  };


  /**
   * Calculates the deletion cost based on the region
   *
   * @public
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.deletionCost = function(scope) {
    if (typeof scope.deletedData != 'undefined' && typeof scope.deletedDuration != 'undefined') {
      if (scope.deletedDuration < 30) {
	return scope.deletedData * regionDeletionRate(scope) * 3;
      } else if (scope.deletedDuration < 60) {
	return scope.deletedData * regionDeletionRate(scope) * 2;
      } else if (scope.deletedDuration < 90) {
	return scope.deletedData * regionDeletionRate(scope);
      } else {
	return 0;
      }
    } else {
      return 0;
    }
  };


  /**
   * Calculates the transfer cost based on the region
   *
   * @public
   * @param {Object} scope - The Angular scope object
   * @return {Float}
   */
  estimate.transferCost = function(scope) {
    if (typeof scope.retrieveData != 'undefined') {
      var currentData = scope.retrieveData - 1;
      var tenTBTierData = dataForTier(currentData, 10000);
      currentData = currentData - tenTBTierData;
      var fortyTBTierData = dataForTier(currentData, 40000);
      currentData = currentData - fortyTBTierData;
      var hundredTBTierData = dataForTier(currentData, 100000);
      currentData = currentData - hundredTBTierData;
      var threeFiftyTBTierData = dataForTier(currentData, 350000);
      currentData = currentData - threeFiftyTBTierData;
      var maxTierData = currentData;

      return rateForTier(scope, tenTBTierData, '10tb') +
            	rateForTier(scope, fortyTBTierData, '40tb') +
            	rateForTier(scope, hundredTBTierData, '100tb') +
            	rateForTier(scope, threeFiftyTBTierData, '350tb') +
            	rateForTier(scope, maxTierData, 'max');
    } else {
      return 0;
    }
  };


  return estimate;
}());
