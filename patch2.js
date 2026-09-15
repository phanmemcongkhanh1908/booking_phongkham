import fs from 'fs';
const file = 'src/pages/admin/ServicesConfig.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `<button
            type="button"
            onClick={() => {
              setEditingService({ name: '', description: '', price: 0, durationMins: 30, bufferBefore: 0, bufferAfter: 0 });
              setShowServiceForm(true);
            }}`,
  `{hasPermission('service.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingService({ name: '', description: '', price: 0, durationMins: 30, bufferBefore: 0, bufferAfter: 0 });
              setShowServiceForm(true);
            }}`
);

code = code.replace(
  `<span>Thêm dịch vụ</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProvider({ `,
  `<span>Thêm dịch vụ</span>
          </button>
          )}
          {hasPermission('provider.manage') && (
          <button
            type="button"
            onClick={() => {
              setEditingProvider({ `
);

code = code.replace(
  `<span>Thêm bác sĩ</span>
          </button>
        </div>
      </div>`,
  `<span>Thêm bác sĩ</span>
          </button>
          )}
        </div>
      </div>`
);

fs.writeFileSync(file, code);
