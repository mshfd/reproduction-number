class EpidemicModel {
  constructor(numIncubationDays, symptomOnsetInfectivityOffsetInDays, infectivityPeriodDays) {
    this.numIncubationDays = numIncubationDays;
    this.symptomOnsetInfectivityOffsetDays = symptomOnsetInfectivityOffsetInDays;
    this.infectivityPeriodDays = infectivityPeriodDays;
    this.generationIntervalDays = infectivityPeriodDays + symptomOnsetInfectivityOffsetInDays;

    infectedLikelihoodModel = function (index) {
      // TODO: Allow different models here.
      // This is what RKI uses for COVID-19 
      return index >= 0 && index <= 1.0 ? 1.0 : 0.0;
    }

    computeInfectedLikelihood = function (offsetDay) {
      const indexDay = offsetDay - this.generationIntervalDays;
      return infectedLikelihoodModel(indexDay / (this.infectivityPeriodDays - 1));
    };

    computeWeightedInfectedLikelihood = function (offsetDay) {
      // P.T. Jacco Wallinga 2004 [https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7110200/]
      // The relative likelihood that cases i have been infected by case j.

      let sum_wt_ik = 0;
      for (let t_k = 0; t_k < this.infectivityPeriodDays; t_k++) {
        const wt_ik = computeInfectedLikelihood(t_k + this.generationIntervalDays);
        sum_wt_ik += wt_ik;
      }

      const wt_ij = computeInfectedLikelihood(offsetDay);
      const p_ij = wt_ij / sum_wt_ik;
      return p_ij;
    };
  }


}