(async () => {
	
	const IS_WEBP_EXPORT_SUPPORTED = document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') == 0;
	class DrawingTokenizer {
        static initialize() {
            this.createUploadDirectory().catch(e => {
                console.error("DrawingTokenizer | " + e.message);
            });
        }

        static getWorldPath() {
            return `worlds/${game.world.id}`;
        }

        static getUploadPath() {
            return `worlds/${game.world.id}/DrawingTokenizerData`;
        }

        /**
         * Convert the selected drawings to an image
         */
        static async convertDrawing(filename, drawings, type, quality) {
            const container = new PIXI.Container();
            const savedGridVisibility = canvas.grid.visible;

            canvas.grid.visible = false;

            for (let drawing of drawings) {
                // Ensure we are grabbing the graphics representation
                const clone = drawing.shape.clone();
                clone.transform.copyFrom(drawing.transform);
                container.addChild(clone);
            }

            const ext = type.split('/')[1];
            if (!filename.endsWith(`.${ext}`)) filename += `.${ext}`;

            try {
                const blob = await DrawingTokenizer.getContainerBlob(container, type, quality);
                await DrawingTokenizer.uploadToFoundry(blob, filename);
            } catch (err) {
                ui.notifications.error("DrawingTokenizer | Conversion failed.");
                console.error(err);
            } finally {
                canvas.grid.visible = savedGridVisibility;
                container.destroy({ children: true });
            }
        }

        static async getContainerBlob(container, type, quality) {
            const renderer = canvas.app.renderer;
            const extractedCanvas = renderer.extract.canvas(container);
            
            return new Promise((resolve) => {
                extractedCanvas.toBlob((blob) => {
                    resolve(blob);
                }, type, quality);
            });
        }

        static async uploadToFoundry(blob, filename) {
            const path = DrawingTokenizer.getUploadPath();
            const file = new File([blob], filename, { type: blob.type });
            const response = await FilePicker.upload("data", path, file);
            
            if (response.path) {
                ui.notifications.info(`Image saved to: ${response.path}`);
            }
            return response;
        }

        static async createUploadDirectory() {
            const source = "data";
            const worldPath = DrawingTokenizer.getWorldPath();
            const uploadPath = DrawingTokenizer.getUploadPath();

            try {
                const browse = await FilePicker.browse(source, worldPath);
                if (!browse.dirs.includes(uploadPath)) {
                    await FilePicker.createDirectory(source, uploadPath);
                }
            } catch (e) {
                console.warn("DrawingTokenizer | Directory check failed.");
            }
        }
		
		/**
		 * Hook into the Drawing toolbar and add a button for conversion of drawings
		 */
		static _getControlButtons(controls){
			const drawingControls = controls.find(c => c.name === "drawings");
            if (!drawingControls) return;

			drawingControls.tools.push({
				name: "DTtoImage",
				title: game.i18n.localize("DRAWINGTOKENIZER.ConvertToImage"),
				icon: "fas fa-image",
				visible: game.user.isGM,
				onChange: () => DrawingTokenizer._convertDrawingDialog(),
				button: true
			  });
			console.log("DrawingTokenizer | Tool added.");
		}

		/**
		 * Present the user with a dialog to convert a drawing to an image.
		 */
		static _convertDrawingDialog() {
            const selectedDrawings = canvas.drawings.controlled;
            if (selectedDrawings.length === 0) {
                return ui.notifications.error("No drawings selected!");
            }

            const WebPText = IS_WEBP_EXPORT_SUPPORTED ? "WebP" : "WebP (Unsupported)";
            
            let content = `
            <form>
                <div class="form-group">
                    <label>Filename</label>
                    <input type="text" name="filename" placeholder="drawing-export" required/>
                </div>
                <div class="form-group">
                    <label>Format</label>
                    <select name="type">
                        <option value="image/png">PNG</option>
                        <option value="image/webp" ${!IS_WEBP_EXPORT_SUPPORTED ? 'disabled' : ''}>${WebPText}</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Quality (0.1 - 1.0)</label>
                    <input type="number" name="quality" value="0.92" step="0.01" min="0" max="1"/>
                </div>
            </form>`;

            new Dialog({
                title: "Convert Drawings to Image",
                content: content,
                buttons: {
                    convert: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "Convert",
                        callback: (html) => {
                            const filename = html.find('[name="filename"]').val();
                            const type = html.find('[name="type"]').val();
                            const quality = parseFloat(html.find('[name="quality"]').val());
                            if (!filename) return ui.notifications.error("Filename is required.");
                            DrawingTokenizer.convertDrawing(filename, selectedDrawings, type, quality);
                        }
                    },
                    cancel: { label: "Cancel" }
                },
                default: "convert"
            }).render(true);
        }
	}
	Hooks.on('getSceneControlButtons', (controls) => DrawingTokenizer._getControlButtons(controls));
	Hooks.once('canvasReady', () => DrawingTokenizer.initialize());
})();
