# mongodb-connection-string-url

MongoDB connection strings, based on the WhatWG URL API

```js
import ConnectionString from 'mongodb-connection-string-url';

const cs = new ConnectionString('mongodb://localhost');
cs.searchParams.set('readPreference', 'secondary');
console.log(cs.href); // 'mongodb://localhost/?readPreference=secondary'
```

## Deviations from the WhatWG URL package

- URL parameters are case-insensitive
- The `.host`, `.hostname` and `.port` properties cannot be set, and reading
  them does not return meaningful results (and are typed as `never`in TypeScript)
- The `.hosts` property contains a list of all hosts in the connection string
- The `.href` property cannot be set, only read
- There is an additional `.isSRV` property, set to `true` for `mongodb+srv://`
- There is an additional `.clone()` utility method on the prototype
  
## AI Agent Configuration
This repository uses [agentskills.io](https://agentskills.io) conventions for AI coding agent
instructions. `AGENTS.md` is the canonical source of truth — tool-specific files like `CLAUDE.md`
are generated references.

### Adding a nested AGENTS.md

1. Create an `AGENTS.md` in the target directory.
2. `git add` the file.
3. Run `scripts/symlink-claude-md.sh` to generate the companion `CLAUDE.md`.
    - Note: `scripts/symlink-claude-md.sh` is vendored from an [internal repo](https://github.com/10gen/mongohouse/blob/master/scripts/symlink-claude-md.sh) and should not be edited directly.
4. Stage and commit the files.
 
## LICENSE

Apache-2.0
