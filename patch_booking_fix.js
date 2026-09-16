import fs from 'fs';
let file = 'src/pages/public/Booking.tsx';
let code = fs.readFileSync(file, 'utf8');

// The faulty replacement:
// code = code.replace(
//  '            </div>\n          </section>',
//  '            </div>\n          )}</section>'
// );
// Wait, I messed up the end. Let's fix the syntax error directly.

// We need to add `)}` at the end of the div.
// Let's find:
//               </div>
//            </div>
//            {/* Mobile Compact Progress Bar */}
code = code.replace(
  '              </div>\n            </div>\n            {/* Mobile Compact Progress',
  '              </div>\n            </div>\n            )}\n            {/* Mobile Compact Progress'
);

// Also remove `)}</section>` if it exists.
code = code.replace('            </div>\n          )}</section>', '            </div>\n          </section>');

fs.writeFileSync(file, code);
