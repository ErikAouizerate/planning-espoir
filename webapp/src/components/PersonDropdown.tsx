import { useDispatch, useSelector } from 'react-redux';
import { selectionToggle } from '../store/actions';
import type { RootState } from '../store/types';
import { PersonMultiSelect } from './PersonMultiSelect';

export function PersonDropdown() {
  const dispatch = useDispatch();
  const people = useSelector((state: RootState) => state.planning.people) ?? [];
  const selection = useSelector((state: RootState) => state.selection.names);
  const { status } = useSelector((state: RootState) => state.config);

  if (status !== 'loaded') {
    return null;
  }
  return (
    <PersonMultiSelect
      people={people}
      selected={selection}
      onToggle={(name) => dispatch(selectionToggle(name))}
    />
  );
}
