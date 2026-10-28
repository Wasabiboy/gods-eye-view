- **Pool Spy** now flies the globe to its Mairangi Bay cohort the moment the
  layer is switched on. The bundled detections cover one small patch of
  Auckland, so enabling the layer from anywhere else used to look broken: the
  row would read ON and the map would stay empty. The layer declares
  `flyToFeaturesOnEnable`, and any local layer can opt in; a camera that
  already frames the whole patch is deliberately left where the user put it.
