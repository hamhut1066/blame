# Notes
I am writing down some notes so that if I come back to this, I can remember how I have done what I have done.

This is mainly for running the tests, but I'll stick some other stuff in here too.

Firstly, to compile the project, you'll need to use yarn (npm should work fine too).

Just do something like `npm install -g yarn`. (This cannot be installed in the same node\_modules of the project).

Then you simply go into the root directory and run `yarn`. (project dependencies)
Then you navigate into `lib_tests/libs/` and run `yarn` again. (testing library dependencies)

Then some symlink magic needs to happen.
For every library that you want to test, you need to symlink `/lib_tests/libs/node_modules` to `/lib_tests/tests/ansicolors/node_modules` (example)


The final thing that needs doing is to navigate to `/lib_tests/libs/node_modules` and symlink `/build` to the name `blame`.
At this point the madness may stop.

Note: All directories are relative to the root of the repository.


# Requirements

apt install ruby-dev
gem install --user json # add this to the path.
