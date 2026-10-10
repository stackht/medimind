// tau-prolog assigns to undeclared globals, which throws in ES-module strict mode.
// Declaring them first lets the library load unchanged in the browser.
for (const name of ['tau_file_system', 'tau_user_input', 'tau_user_output', 'tau_user_error',
  'nodejs_file_system', 'nodejs_user_input', 'nodejs_user_output', 'nodejs_user_error']) {
  if (!(name in globalThis)) globalThis[name] = undefined;
}
