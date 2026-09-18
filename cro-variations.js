window.croVariations = {
  hero_headline_test: {
    variant_a: function () {
      var heading = document.querySelector('#intro .banner-title');
      if (heading) {
        heading.textContent = 'Headline changed';
      }

      var ctaBtn = document.querySelector('#intro a[href="#features"]');
      if (ctaBtn) {
        ctaBtn.textContent = 'Btn Text changed';
        ctaBtn.style.backgroundColor = '#F64B39';
      }
    }
  }
};
