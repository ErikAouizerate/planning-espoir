# improvements

## usage

ce document contient une liste de remarque, tu dois analyser et faire un plan / spec pour les résoudre.
tu peux regrouper les remarque qui vont ensemble ou qu'il est pertinant de traiter en meme temps
une fois traité, tu dois supprimer la remarque correspondante

## todo

- met en avant le jour courant avec une couleur differente pour le fond
- j'ai ce warning sur les create store , utilise configureStore à la place: 
The signature '(reducer: Reducer<{ planning: PlanningState; schedule: ScheduleState; config: ConfigState; selection: SelectionState; colors: ColorsState; }, import("/home/riko/workspace/planning-espoir/node_modules/redux/dist/redux").Action<...> | import("/home/riko/workspace/planning-espoir/webapp/src/store/actions").Action<...>, RootState>, preloadedState?: RootState | undefined, enhancer?: StoreEnhancer<...> | undefined): Store<...>' of 'createStore' is deprecated.
redux.d.ts(353, 4): The declaration was marked as deprecated here.
⚠ Error (TS6387) | | | 
(alias) createStore<{
 planning: PlanningState;
 schedule: ScheduleState;
 config: ConfigState;
 selection: SelectionState;
 colors: ColorsState;
}, Action<string, unknown> | Action<string>, {
 dispatch: unknown;
}, {}>(reducer: Reducer<{
 planning: PlanningState;
 schedule: ScheduleState;
 config: ConfigState;
 selection: SelectionState;
 colors: ColorsState;
}, Action<...> | Action<...>, {
 ...;
}>, enhancer?: StoreEnhancer<...> | undefined): Store<...> & {
 ...;
} (+1 overload)
import createStore

@deprecated
We recommend using the configureStore method of the @reduxjs/toolkit package, which replaces createStore.

Redux Toolkit is our recommended approach for writing Redux logic today, including store setup, reducers, data fetching, and more.

For more details, please read this Redux docs page: https://redux.js.org/introduction/why-rtk-is-redux-today

configureStore from Redux Toolkit is an improved version of createStore that simplifies setup and helps avoid common bugs.

You should not be using the redux core package by itself today, except for learning purposes. The createStore method from the core redux package will not be removed, but we encourage all users to migrate to using Redux Toolkit for all Redux code.

If you want to use createStore without this visual deprecation warning, use the legacy_createStore import instead:

import { legacy_createStore as createStore} from 'redux'

- warning dans planning.service.ts Namespace 'global.Express' has no exported member 'Multer'.
- warning dans les fichier de spec dans l'api : Cannot find name 'describe'. Do you need to install type definitions for a test runner? Try `npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha` and then add 'jest' or 'mocha' to the types field in your tsconfig.