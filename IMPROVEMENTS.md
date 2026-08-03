# improvements

## usage

ce document contient une liste de remarque, tu dois analyser et faire un plan / spec pour les résoudre.
tu peux regrouper les remarque qui vont ensemble ou qu'il est pertinant de traiter en meme temps
une fois traité, tu dois supprimer la remarque correspondante

## todo

- ajoute la config prettier et lint tous les fichier avec
- dans les actions, tu n'as pas reutilisé les action mais dispatch un nouvel objet. ex :             store.dispatch({ type: CONFIG_FETCH_SUCCESS, payload: data });

Il faut que tu créer toutes les actions possible et que le seul moyen de les dipatcher c'est d'importer cette action.
- rajoute le middleware redux-logger en dev. avec collapse: false