# Conventions

## Nommage des clés étrangères

Une clé étrangère se nomme d'après la table référencée, pas d'après son rôle
fonctionnel : `<table>Id`, pas un nom décrivant à quoi elle sert.

Exemple : la colonne de `prompts` qui référence la table `sources` s'appelle
`sourceId` (et non `inputImageId`).
