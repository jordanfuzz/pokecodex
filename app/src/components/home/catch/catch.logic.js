export const multiSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    border: state.isFocused ? '1px solid black' : 'none',
    borderRadius: '0%',
    boxShadow: 'none',
    textAlign: 'left',
    minHeight: '55px',
  }),
  option: (provided, state) => ({
    ...provided,
    color: 'black',
    cursor: 'pointer',
    textAlign: 'left',
  }),
  placeholder: provided => ({
    ...provided,
    color: 'black',
  }),
  dropdownIndicator: provided => ({
    ...provided,
    color: 'black',
    cursor: 'pointer',
  }),
  indicatorSeparator: provided => ({
    ...provided,
    color: 'black',
  }),
  menu: provided => ({
    ...provided,
    borderRadius: '0%',
  }),
  menuList: provided => ({
    ...provided,
    border: 'none',
    borderRadius: '0%',
    paddingTop: '0',
    paddingBottom: '0',
  }),
}
